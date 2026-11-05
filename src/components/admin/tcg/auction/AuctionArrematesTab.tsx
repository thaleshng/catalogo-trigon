import React, { useState, useMemo, useEffect } from 'react';
import {
  CustomerArremateGroup,
  TcgAuction,
  TcgAuctionItem,
  AuctionPaymentStatus,
  AuctionShippingStatus,
} from '../../../../types';
import { formatCurrency, formatAuctionPeriod } from '../../../../utils/formatters';
import { useToast } from '../../../../components/common/Toast';
import { auctionService } from '../../../../services/auctionService';
import { Pagination } from '../../../common/Pagination';
import {
  User,
  AlertTriangle,
  Copy,
  Receipt,
  Search,
  Package,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Gavel,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { AuctionCustomerReceiptModal } from './AuctionCustomerReceiptModal';

interface AuctionArrematesTabProps {
  groups: CustomerArremateGroup[];
  auctions: TcgAuction[];
  onRefresh: () => void;
}

export const AuctionArrematesTab: React.FC<AuctionArrematesTabProps> = ({
  groups,
  auctions,
  onRefresh,
}) => {
  const { success, error, info } = useToast();

  const [selectedAuctionFilter, setSelectedAuctionFilter] = useState('');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState('');
  const [selectedShippingFilter, setSelectedShippingFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Expansão individual de cada cliente (dentro do leilão)
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  // Expansão das seções/abas de cada leilão (Accordion)
  const [expandedAuctions, setExpandedAuctions] = useState<Record<string, boolean>>({});

  // Modal de Extrato Visual do Cliente
  const [receiptGroup, setReceiptGroup] = useState<CustomerArremateGroup | null>(null);

  const isCustomerExpanded = (key: string) => {
    return expandedKeys[key] ?? true;
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const current = prev[key] ?? true;
      return { ...prev, [key]: !current };
    });
  };

  // Filtra os grupos de arremates
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (selectedAuctionFilter && g.auction.id !== selectedAuctionFilter) return false;
      if (selectedPaymentFilter) {
        if (selectedPaymentFilter === 'PENDENCIAS' && g.allPaid) return false;
        if (selectedPaymentFilter === 'PAGO' && !g.allPaid) return false;
        if (selectedPaymentFilter === 'PENDENTE' && (g.allPaid || g.isOverdue)) return false;
        if (selectedPaymentFilter === 'VENCIDO' && !g.isOverdue) return false;
      }
      if (selectedShippingFilter && g.shippingStatus !== selectedShippingFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = g.customer.name.toLowerCase().includes(q);
        const matchPhone = g.customer.phone?.toLowerCase().includes(q);
        const matchAuction = g.auction.code.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchAuction) return false;
      }
      return true;
    });
  }, [groups, selectedAuctionFilter, selectedPaymentFilter, selectedShippingFilter, searchQuery]);

  // Opções das abas / pílulas de filtro rápido por leilão
  const auctionPillOptions = useMemo(() => {
    const countMap = new Map<string, { auction: TcgAuction; count: number }>();
    for (const g of groups) {
      const a = g.auction;
      if (!countMap.has(a.id)) {
        const fullAuction = auctions.find((auc) => auc.id === a.id) || a;
        countMap.set(a.id, { auction: fullAuction, count: 0 });
      }
      countMap.get(a.id)!.count++;
    }

    const list = Array.from(countMap.values());
    list.sort((a, b) => (b.auction.code || '').localeCompare(a.auction.code || ''));
    return list;
  }, [groups, auctions]);

  // Agrupa os clientes filtrados por Leilão
  const sectionsByAuction = useMemo(() => {
    const map = new Map<
      string,
      {
        auction: TcgAuction;
        groups: CustomerArremateGroup[];
        totalValue: number;
        totalCards: number;
        paidCount: number;
        pendingCount: number;
        overdueCount: number;
      }
    >();

    for (const g of filteredGroups) {
      const aucId = g.auction.id;
      if (!map.has(aucId)) {
        const fullAuction = auctions.find((a) => a.id === aucId) || g.auction;
        map.set(aucId, {
          auction: fullAuction,
          groups: [],
          totalValue: 0,
          totalCards: 0,
          paidCount: 0,
          pendingCount: 0,
          overdueCount: 0,
        });
      }
      const entry = map.get(aucId)!;
      entry.groups.push(g);
      entry.totalValue += g.totalValue;
      entry.totalCards += g.items.length;
      if (g.allPaid) entry.paidCount++;
      else if (g.isOverdue) entry.overdueCount++;
      else entry.pendingCount++;
    }

    // Ordenação fixa e estável dos clientes dentro de cada leilão por nome (não pula de lugar ao atualizar status)
    for (const entry of map.values()) {
      entry.groups.sort((a, b) =>
        (a.customer.name || '').localeCompare(b.customer.name || '', 'pt-BR') ||
        a.customer.id.localeCompare(b.customer.id)
      );
    }

    const list = Array.from(map.values());
    list.sort((a, b) => (b.auction.code || '').localeCompare(a.auction.code || ''));
    return list;
  }, [filteredGroups, auctions]);

  // Paginação dos Leilões no Relatório
  const [auctionPage, setAuctionPage] = useState(1);
  const [auctionsPerPage, setAuctionsPerPage] = useState(3);
  // Paginação de Clientes dentro de cada leilão (caso haja muitos clientes arrematantes)
  const [customerPageMap, setCustomerPageMap] = useState<Record<string, number>>({});

  useEffect(() => {
    setAuctionPage(1);
  }, [selectedAuctionFilter, selectedPaymentFilter, selectedShippingFilter, searchQuery]);

  const totalAuctionPages = Math.max(1, Math.ceil(sectionsByAuction.length / auctionsPerPage));
  const paginatedSections = useMemo(() => {
    const start = (auctionPage - 1) * auctionsPerPage;
    return sectionsByAuction.slice(start, start + auctionsPerPage);
  }, [sectionsByAuction, auctionPage, auctionsPerPage]);

  // Controle de Expandir / Recolher por Leilão
  const isAuctionExpanded = (auctionId: string) => {
    return expandedAuctions[auctionId] ?? false; // padrão recolhido (collapsed) de início
  };

  const toggleAuction = (auctionId: string) => {
    setExpandedAuctions((prev) => {
      const current = prev[auctionId] ?? false;
      return {
        ...prev,
        [auctionId]: !current,
      };
    });
  };

  const expandAllAuctions = () => {
    const next: Record<string, boolean> = {};
    for (const s of sectionsByAuction) {
      next[s.auction.id] = true;
    }
    setExpandedAuctions(next);
  };

  const collapseAllAuctions = () => {
    const next: Record<string, boolean> = {};
    for (const s of sectionsByAuction) {
      next[s.auction.id] = false;
    }
    setExpandedAuctions(next);
  };

  const handleCopyPaymentNotice = async (g: CustomerArremateGroup) => {
    const deadlineFormatted = new Date(g.paymentDeadline).toLocaleDateString('pt-BR');
    const text = auctionService.formatCustomerPaymentNotice({
      customerName: g.customer.name,
      auctionCode: g.auction.code,
      deadlineFormatted,
    });
    try {
      await navigator.clipboard.writeText(text);
      success(`Mensagem de cobrança do leilão #${g.auction.code} copiada para o WhatsApp!`);
    } catch {
      error('Não foi possível copiar para a área de transferência.');
    }
  };

  const handleCopyItemsSummary = async (g: CustomerArremateGroup) => {
    const text = auctionService.formatCustomerItemsSummary({
      customerName: g.customer.name,
      auctionCode: g.auction.code,
      items: g.items,
      totalValue: g.totalValue,
    });
    try {
      await navigator.clipboard.writeText(text);
      success(`Resumo de arremates de ${g.customer.name} copiado para o WhatsApp!`);
    } catch {
      error('Não foi possível copiar para a área de transferência.');
    }
  };

  const handleCopyOverdueNotice = async (g: CustomerArremateGroup) => {
    const text = auctionService.formatCustomerOverdueNotice({
      customerName: g.customer.name,
    });
    try {
      await navigator.clipboard.writeText(text);
      info(`Mensagem de prazo vencido copiada para o WhatsApp!`);
    } catch {
      error('Não foi possível copiar para a área de transferência.');
    }
  };

  const handleUpdateItemStatus = async (
    itemId: string,
    updates: { paymentStatus?: AuctionPaymentStatus; shippingStatus?: AuctionShippingStatus }
  ) => {
    try {
      await auctionService.updateItemStatuses({
        itemId,
        ...updates,
      });
      success('Status atualizado!');
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar status.');
    }
  };

  // Renderiza o card individual de um cliente e seus lotes
  const renderCustomerGroupCard = (g: CustomerArremateGroup) => {
    const groupKey = `${g.customer.id}__${g.auction.id}`;
    const isExpanded = isCustomerExpanded(groupKey);

    // Itens ordenados determinística e estavelmente por índice de lote e título (não pulam de ordem ao mudar status)
    const sortedItems = [...g.items].sort(
      (a, b) =>
        (a.orderIndex ?? 0) - (b.orderIndex ?? 0) ||
        (a.title || '').localeCompare(b.title || '', 'pt-BR') ||
        a.id.localeCompare(b.id)
    );

    return (
      <div
        key={groupKey}
        className={`p-5 rounded-2xl border transition-all ${
          g.isOverdue
            ? 'bg-crimson-950/20 border-crimson-500/50 shadow-glow-crimson'
            : g.allPaid
              ? 'bg-trigon-950 border-trigon-800'
              : 'bg-trigon-950 border-amber-500/30'
        }`}
      >
        {/* Cabeçalho do Cliente */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                g.allPaid
                  ? 'bg-blue-950/80 border-blue-500/40 text-blue-400'
                  : g.isOverdue
                    ? 'bg-crimson-950/80 border-crimson-500/60 text-crimson-400 animate-pulse'
                    : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
              }`}
            >
              <User className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h4
                  className="font-bold text-white text-base shrink-0"
                  title={g.customer.name}
                >
                  {g.customer.name}
                </h4>
                <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-trigon-900 border border-trigon-700 text-trigon-300 shrink-0">
                  Leilão #{g.auction.code}
                </span>

                {/* Status de Pagamento */}
                {g.allPaid ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 shrink-0">
                    ✓ PAGO
                  </span>
                ) : g.isOverdue ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-crimson-950 text-crimson-300 border border-crimson-500/60 animate-pulse shrink-0">
                    ⚠️ PRAZO VENCIDO
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40 shrink-0">
                    ⏱ PENDENTE ({g.hoursRemaining > 0 ? `${g.hoursRemaining}h restantes` : 'expirando'})
                  </span>
                )}

                {/* Status de Envio */}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    g.shippingStatus === 'ENVIADO'
                      ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                      : g.shippingStatus === 'SOLICITADO'
                        ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                        : 'bg-trigon-900 text-trigon-400 border border-trigon-750'
                  }`}
                >
                  📦 Envio: {g.shippingStatus.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-trigon-400 flex-wrap">
                {g.customer.phone && (
                  <span className="font-mono text-trigon-300 shrink-0">
                    📱 {g.customer.phone}
                  </span>
                )}
                <span className="truncate">
                  Prazo 48h: <strong>{new Date(g.paymentDeadline).toLocaleString('pt-BR')}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Lado Direito: Valor Total e Botões de Ação para o WhatsApp */}
          <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-trigon-400 block tracking-wider">
                Total dos Arremates
              </span>
              <span className="font-mono text-xl font-black text-emerald-400 block leading-tight">
                {formatCurrency(g.totalValue)}
              </span>
              <span className="text-[11px] text-trigon-400 block">
                {g.items.length} carta(s) arrematada(s)
              </span>
            </div>

            {/* Botões Rápidos para o WhatsApp */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleCopyPaymentNotice(g)}
                title="Copiar Mensagem Padrão de Cobrança 48h com PIX do Gabriel"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-trigon-900 hover:bg-emerald-950 border border-trigon-750 hover:border-emerald-500/50 text-xs font-semibold text-emerald-300 transition-all shadow-sm shrink-0 whitespace-nowrap"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Copiar Cobrança (48h)</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyItemsSummary(g)}
                title="Copiar Lista Detalhada das Cartas Arrematadas"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-trigon-900 hover:bg-trigon-850 border border-trigon-750 text-xs font-semibold text-white transition-all shadow-sm shrink-0 whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Lista</span>
              </button>

              {g.isOverdue && (
                <button
                  type="button"
                  onClick={() => handleCopyOverdueNotice(g)}
                  title="Copiar Mensagem de Prazo Vencido"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-crimson-900/60 hover:bg-crimson-800 border border-crimson-500/50 text-xs font-semibold text-crimson-200 transition-all shadow-sm shrink-0 whitespace-nowrap"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Msg Vencido</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setReceiptGroup(g)}
                title="Visualizar Extrato Visual da Trigon para enviar no WhatsApp"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-950/80 to-trigon-900 hover:from-amber-900/80 border border-amber-500/40 text-xs font-bold text-amber-300 transition-all shadow-sm shrink-0 whitespace-nowrap"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Extrato / Print</span>
              </button>

              <button
                type="button"
                onClick={() => toggleExpand(groupKey)}
                className="p-2 rounded-xl bg-trigon-900 hover:bg-trigon-850 text-trigon-400 hover:text-white transition-colors shrink-0"
                title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Tabela dos Itens Arrematados (Expansível) */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-trigon-850 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-trigon-400 uppercase tracking-wider border-b border-trigon-800">
                  <th className="pb-2.5 font-semibold">Carta / Item</th>
                  <th className="pb-2.5 font-semibold">Coleção</th>
                  <th className="pb-2.5 font-semibold">Condição</th>
                  <th className="pb-2.5 font-semibold">Idioma</th>
                  <th className="pb-2.5 font-semibold">Valor Arremate</th>
                  <th className="pb-2.5 font-semibold">Status Pagamento</th>
                  <th className="pb-2.5 font-semibold">Situação Envio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trigon-850">
                {sortedItems.map((it: TcgAuctionItem) => {
                  const activePhoto = it.customPhotoUrl || it.apiImageUrl;
                  return (
                    <tr key={it.id} className="hover:bg-trigon-900/40 transition-colors">
                      <td className="py-2.5 flex items-center gap-2.5">
                        <div className="w-8 h-11 rounded bg-trigon-900 border border-trigon-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {activePhoto ? (
                            <img
                              src={activePhoto}
                              alt={it.title}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Package className="w-4 h-4 text-trigon-600" />
                          )}
                        </div>
                        <span className="font-semibold text-white truncate max-w-[200px]">
                          {it.title}
                        </span>
                      </td>
                      <td className="py-2.5 text-trigon-400 truncate max-w-[150px]">
                        {it.subtitle || '—'}
                      </td>
                      <td className="py-2.5">
                        {it.condition ? (
                          <span>
                            {auctionService.getConditionEmoji(it.condition)} {it.condition}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5">
                        {it.language ? (
                          <span>
                            {auctionService.getLanguageFlag(it.language)} {it.language}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 font-mono font-bold text-emerald-400">
                        {it.isFreebie ? (
                          <span className="text-purple-300">🎁 BRINDE</span>
                        ) : (
                          formatCurrency(it.finalPrice || it.initialPrice)
                        )}
                      </td>
                      <td className="py-2.5">
                        <select
                          value={it.paymentStatus}
                          onChange={(e) =>
                            handleUpdateItemStatus(it.id, {
                              paymentStatus: e.target.value as AuctionPaymentStatus,
                            })
                          }
                          className={`px-2 py-1 rounded-lg text-xs font-bold border focus:outline-none ${
                            it.paymentStatus === 'PAGO'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                              : it.paymentStatus === 'VENCIDO'
                                ? 'bg-crimson-950 text-crimson-300 border-crimson-500/50'
                                : 'bg-amber-950 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          <option value="PENDENTE">Pendente</option>
                          <option value="PAGO">Pago</option>
                          <option value="VENCIDO">Vencido</option>
                        </select>
                      </td>
                      <td className="py-2.5">
                        <select
                          value={it.shippingStatus}
                          onChange={(e) =>
                            handleUpdateItemStatus(it.id, {
                              shippingStatus: e.target.value as AuctionShippingStatus,
                            })
                          }
                          className="px-2 py-1 rounded-lg bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none"
                        >
                          <option value="NAO_SOLICITADO">Não Solicitado (Guardado)</option>
                          <option value="SOLICITADO">Solicitado</option>
                          <option value="ENVIADO">Enviado</option>
                          <option value="RECEBIDO">Recebido</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Busca */}
      <div className="p-4 rounded-2xl bg-trigon-950 border border-trigon-800 space-y-3.5">
        {/* Cabeçalho da Seção de Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-trigon-850/80">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Receipt className="w-5 h-5 text-crimson-400 shrink-0" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Relatório de Arremates & Cobranças
            </h3>
            <span className="text-xs text-trigon-400 font-normal">
              • {filteredGroups.length} cliente(s) arrematante(s) em {sectionsByAuction.length} leilão(ões)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(selectedPaymentFilter ||
              selectedShippingFilter ||
              selectedAuctionFilter ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPaymentFilter('');
                  setSelectedShippingFilter('');
                  setSelectedAuctionFilter('');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-trigon-400 hover:text-white hover:bg-trigon-900 border border-trigon-800 transition-all"
              >
                ✕ Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {/* Linha Alinhada de Filtros (Busca + 3 Selects alinhados lado a lado) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
          {/* 1. Busca por Texto Livre */}
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-trigon-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por nome do cliente, telefone ou ID do leilão..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 placeholder:text-trigon-500 transition-colors"
            />
          </div>

          {/* 2. Filtro por Leilão (fonte padrão sem serifa, alinhado aos outros selects) */}
          <div className="lg:col-span-3">
            <select
              value={selectedAuctionFilter}
              onChange={(e) => {
                setSelectedAuctionFilter(e.target.value);
                if (e.target.value) {
                  setExpandedAuctions((prev) => ({ ...prev, [e.target.value]: true }));
                }
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 transition-colors"
            >
              <option value="">Todos os Leilões</option>
              {auctions.map((a) => (
                <option key={a.id} value={a.id}>
                  Leilão #{a.code}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filtro por Pagamento */}
          <div className="lg:col-span-2">
            <select
              value={selectedPaymentFilter}
              onChange={(e) => setSelectedPaymentFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 transition-colors"
            >
              <option value="">Todos os Pagamentos</option>
              <option value="PENDENCIAS">⚠️ Todas as Pendências</option>
              <option value="PENDENTE">Pendentes (no prazo)</option>
              <option value="VENCIDO">Vencidos (48h)</option>
              <option value="PAGO">Pagos / Baixados</option>
            </select>
          </div>

          {/* 4. Filtro por Envio */}
          <div className="lg:col-span-2">
            <select
              value={selectedShippingFilter}
              onChange={(e) => setSelectedShippingFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 transition-colors"
            >
              <option value="">Todos os Envios</option>
              <option value="NAO_SOLICITADO">📦 Não Solicitado</option>
              <option value="SOLICITADO">Solicitado</option>
              <option value="ENVIADO">Enviado</option>
              <option value="RECEBIDO">Recebido</option>
            </select>
          </div>
        </div>

        {/* Botões de Filtro Rápido */}
        <div className="flex items-center gap-2 pt-0.5 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-trigon-400 font-bold shrink-0">
            Filtros Rápidos:
          </span>
          <button
            type="button"
            onClick={() =>
              setSelectedPaymentFilter((prev) => (prev === 'PENDENCIAS' ? '' : 'PENDENCIAS'))
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              selectedPaymentFilter === 'PENDENCIAS'
                ? 'bg-amber-950 text-amber-300 border-amber-500/60 shadow-glow-amber'
                : 'bg-trigon-900 hover:bg-trigon-850 text-trigon-300 border-trigon-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Pendência de Pagamento</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedShippingFilter((prev) =>
                prev === 'NAO_SOLICITADO' ? '' : 'NAO_SOLICITADO'
              )
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              selectedShippingFilter === 'NAO_SOLICITADO'
                ? 'bg-blue-950 text-blue-300 border-blue-500/60 shadow-glow-blue'
                : 'bg-trigon-900 hover:bg-trigon-850 text-trigon-300 border-trigon-800'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-blue-400" />
            <span>Envio Não Solicitado</span>
          </button>
        </div>

        {/* Abas / Pílulas de Navegação Rápida por Leilão */}
        {auctionPillOptions.length > 0 && (
          <div className="pt-2 border-t border-trigon-850/80 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setSelectedAuctionFilter('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                !selectedAuctionFilter
                  ? 'bg-crimson-600 text-white shadow-glow-crimson'
                  : 'bg-trigon-900 hover:bg-trigon-850 text-trigon-300 border border-trigon-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Todos os Leilões ({groups.length})</span>
            </button>

            {auctionPillOptions.map((opt) => (
              <button
                key={opt.auction.id}
                type="button"
                onClick={() => {
                  const newFilter = selectedAuctionFilter === opt.auction.id ? '' : opt.auction.id;
                  setSelectedAuctionFilter(newFilter);
                  if (newFilter) {
                    setExpandedAuctions((prev) => ({ ...prev, [opt.auction.id]: true }));
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedAuctionFilter === opt.auction.id
                    ? 'bg-crimson-600 text-white shadow-glow-crimson'
                    : 'bg-trigon-900 hover:bg-trigon-850 text-trigon-300 border border-trigon-800'
                }`}
              >
                <Gavel className="w-3 h-3 text-crimson-400" />
                <span>Leilão #{opt.auction.code} ({opt.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Barra de Ações Rápidas de Expandir / Recolher Tudo */}
      {sectionsByAuction.length > 0 && (
        <div className="flex items-center justify-between text-xs text-trigon-400 px-1">
          <span>
            Exibindo <strong>{sectionsByAuction.length}</strong> leilão(ões) com <strong>{filteredGroups.length}</strong> cliente(s) arrematante(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAllAuctions}
              className="px-2.5 py-1 rounded-lg bg-trigon-900 hover:bg-trigon-850 border border-trigon-800 text-[11px] font-semibold text-trigon-300 hover:text-white transition-all"
            >
              Expandir Todos os Leilões
            </button>
            <button
              type="button"
              onClick={collapseAllAuctions}
              className="px-2.5 py-1 rounded-lg bg-trigon-900 hover:bg-trigon-850 border border-trigon-800 text-[11px] font-semibold text-trigon-300 hover:text-white transition-all"
            >
              Recolher Todos os Leilões
            </button>
          </div>
        </div>
      )}

      {/* Lista Agrupada por Leilão com Accordion (Expand & Collapse) */}
      {sectionsByAuction.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-trigon-950 border border-trigon-800 space-y-2">
          <Receipt className="w-8 h-8 text-trigon-600 mx-auto" />
          <p className="text-sm text-trigon-400">
            Nenhum arremate encontrado com os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {paginatedSections.map((sec) => {
            const isExpanded = isAuctionExpanded(sec.auction.id);
            const custPerPage = 5;
            const custPage = customerPageMap[sec.auction.id] || 1;
            const totalCustPages = Math.max(1, Math.ceil(sec.groups.length / custPerPage));
            const startCust = (custPage - 1) * custPerPage;
            const paginatedGroups = sec.groups.slice(startCust, startCust + custPerPage);

            return (
              <div
                key={sec.auction.id}
                className="rounded-2xl border border-trigon-800 bg-trigon-950/80 overflow-hidden shadow-sm transition-all"
              >
                {/* Cabeçalho do Leilão com Expand / Collapse */}
                <div
                  onClick={() => toggleAuction(sec.auction.id)}
                  className="px-5 py-4 bg-gradient-to-r from-trigon-900/90 via-trigon-900/60 to-trigon-950 hover:bg-trigon-850/80 border-b border-trigon-800/80 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 select-none"
                >
                  {/* Título & Período do Leilão */}
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-crimson-950/80 border border-crimson-500/40 text-crimson-400 flex items-center justify-center shrink-0">
                      <Gavel className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="font-cinzel text-base font-bold text-white tracking-wide">
                          Leilão #{sec.auction.code}
                        </h4>
                        {sec.auction.title && sec.auction.title !== `Leilão #${sec.auction.code}` && (
                          <span className="text-xs text-trigon-300 font-medium truncate max-w-xs">
                            • {sec.auction.title}
                          </span>
                        )}
                        {sec.auction.startDate && (
                          <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-trigon-950 border border-trigon-800 text-trigon-300">
                            {formatAuctionPeriod(sec.auction.startDate, sec.auction.endDate)}
                          </span>
                        )}
                        {sec.auction.status && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              sec.auction.status === 'FINALIZADO'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : sec.auction.status === 'EM_ANDAMENTO'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                                  : 'bg-trigon-900 text-trigon-400 border border-trigon-750'
                            }`}
                          >
                            {sec.auction.status === 'EM_ANDAMENTO' ? 'EM ANDAMENTO' : sec.auction.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-trigon-400 mt-0.5">
                        {sec.groups.length} cliente(s) com compras • {sec.totalCards} carta(s) arrematada(s)
                      </p>
                    </div>
                  </div>

                  {/* Resumo Financeiro & Chevron de Expand/Collapse */}
                  <div className="flex items-center gap-4 self-end md:self-center">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-trigon-400 block tracking-wider">
                        Total Arrematado
                      </span>
                      <span className="font-mono text-lg font-black text-emerald-400 block">
                        {formatCurrency(sec.totalValue)}
                      </span>
                      <div className="flex items-center gap-1.5 justify-end text-[10px] mt-0.5 flex-wrap">
                        {sec.paidCount > 0 && (
                          <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {sec.paidCount} pago(s)
                          </span>
                        )}
                        {sec.pendingCount > 0 && (
                          <span className="text-amber-300 font-semibold inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {sec.pendingCount} pendente(s)
                          </span>
                        )}
                        {sec.overdueCount > 0 && (
                          <span className="text-crimson-400 font-bold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {sec.overdueCount} vencido(s)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-trigon-950/80 border border-trigon-750 text-trigon-400 hover:text-white transition-colors">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-crimson-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-trigon-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Lista de Clientes do Leilão (quando expandido) */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-4 bg-trigon-950/40">
                    {paginatedGroups.map(renderCustomerGroupCard)}

                    {sec.groups.length > custPerPage && (
                      <Pagination
                        currentPage={custPage}
                        totalPages={totalCustPages}
                        totalItems={sec.groups.length}
                        itemsPerPage={custPerPage}
                        onPageChange={(p) =>
                          setCustomerPageMap((prev) => ({ ...prev, [sec.auction.id]: p }))
                        }
                        itemLabel="cliente(s)"
                        className="rounded-xl border border-trigon-800 bg-trigon-900/60"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {sectionsByAuction.length > 0 && (
            <Pagination
              currentPage={auctionPage}
              totalPages={totalAuctionPages}
              totalItems={sectionsByAuction.length}
              itemsPerPage={auctionsPerPage}
              onPageChange={setAuctionPage}
              onItemsPerPageChange={(newSize) => {
                setAuctionsPerPage(newSize);
                setAuctionPage(1);
              }}
              itemsPerPageOptions={[3, 5, 10]}
              itemLabel="leilão(ões)"
              className="rounded-2xl border border-trigon-800"
            />
          )}
        </div>
      )}

      {/* Modal de Extrato Visual do Cliente */}
      {receiptGroup && (
        <AuctionCustomerReceiptModal
          isOpen={Boolean(receiptGroup)}
          onClose={() => setReceiptGroup(null)}
          group={receiptGroup}
        />
      )}
    </div>
  );
};
