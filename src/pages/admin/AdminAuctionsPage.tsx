import React, { useState, useEffect, useMemo } from 'react';
import {
  TcgAuction,
  AuctionDashboardStats,
  CustomerArremateGroup,
  TcgCardVariant,
} from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { auctionService } from '../../services/auctionService';
import { cardStockService } from '../../services/cardStockService';
import { matchesCardQuery } from '../../services/tcgdexService';
import { useToast } from '../../components/common/Toast';
import { AuctionDashboardTab } from '../../components/admin/tcg/auction/AuctionDashboardTab';
import { AuctionListTab } from '../../components/admin/tcg/auction/AuctionListTab';
import { AuctionDetailsView } from '../../components/admin/tcg/auction/AuctionDetailsView';
import { AuctionArrematesTab } from '../../components/admin/tcg/auction/AuctionArrematesTab';
import { AddCardToAuctionModal } from '../../components/admin/tcg/auction/AddCardToAuctionModal';
import {
  Gavel,
  LayoutDashboard,
  Receipt,
  ListOrdered,
  RefreshCw,
  Search,
  Layers,
  CheckSquare,
  Square,
} from 'lucide-react';

export const AdminAuctionsPage: React.FC = () => {
  const { error } = useToast();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'leiloes' | 'arremates'>('leiloes');
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [auctions, setAuctions] = useState<TcgAuction[]>([]);
  const [dashboardStats, setDashboardStats] = useState<AuctionDashboardStats>({
    totalAuctions: 0,
    totalItems: 0,
    totalArrematados: 0,
    totalNaoArrematados: 0,
    conversionRate: 0,
    totalArrematadoValue: 0,
    totalPendingValue: 0,
    totalPaidValue: 0,
    totalCostValue: 0,
    totalProfitValue: 0,
    profitMargin: 0,
  });
  const [arremateGroups, setArremateGroups] = useState<CustomerArremateGroup[]>([]);

  // Modal para adicionar carta ao leilão (suporte a carta única ou duplas/combos)
  const [cardVariantForAuction, setCardVariantForAuction] = useState<TcgCardVariant | null>(null);
  const [initialVariantsForAuction, setInitialVariantsForAuction] = useState<TcgCardVariant[]>([]);
  const [isStockSelectModalOpen, setIsStockSelectModalOpen] = useState(false);
  const [selectedStockVariantIds, setSelectedStockVariantIds] = useState<string[]>([]);
  const [stockVariants, setStockVariants] = useState<TcgCardVariant[]>([]);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [detailsRefreshTrigger, setDetailsRefreshTrigger] = useState(0);

  const loadData = async () => {
    try {
      setLoading(true);
      const [aucList, stats, groups] = await Promise.all([
        auctionService.getAuctions(),
        auctionService.getDashboardStats(),
        auctionService.getCustomerArremateGroups(),
      ]);
      setAuctions(aucList);
      setDashboardStats(stats);
      setArremateGroups(groups);
    } catch (err: any) {
      error(err.message || 'Erro ao carregar dados dos leilões.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    setDetailsRefreshTrigger((prev) => prev + 1);
    await loadData();
  };

  useEffect(() => {
    loadData();
  }, []);

  // Abre seletor de cartas do estoque para adicionar ao leilão
  const handleOpenStockCardPicker = async (targetAuctionId: string) => {
    try {
      const variants = await cardStockService.getVariants();
      // Mostra apenas cartas com saldo > 0
      const available = variants.filter((v) => v.quantity > 0);
      setStockVariants(available);
      setSelectedStockVariantIds([]);
      setSelectedAuctionId(targetAuctionId);
      setIsStockSelectModalOpen(true);
    } catch (err: any) {
      error(err.message || 'Erro ao carregar cartas do estoque.');
    }
  };

  const handleToggleSelectCard = (variantId: string) => {
    setSelectedStockVariantIds((prev) =>
      prev.includes(variantId)
        ? prev.filter((id) => id !== variantId)
        : [...prev, variantId]
    );
  };

  const handleConfirmStockSelection = () => {
    if (selectedStockVariantIds.length === 0) return;
    const picked = stockVariants.filter((v) => selectedStockVariantIds.includes(v.id));
    setInitialVariantsForAuction(picked);
    setCardVariantForAuction(picked[0] || null);
    setIsStockSelectModalOpen(false);
    setIsAddCardModalOpen(true);
  };

  const handleSelectCardDirectly = (variant: TcgCardVariant) => {
    setInitialVariantsForAuction([variant]);
    setCardVariantForAuction(variant);
    setIsStockSelectModalOpen(false);
    setIsAddCardModalOpen(true);
  };

  const filteredStockVariants = useMemo(() => {
    return stockVariants.filter((v) => matchesCardQuery(stockSearchQuery, v.card));
  }, [stockVariants, stockSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Gavel className="w-8 h-8 text-crimson-500" />
            <span>LEILÕES TCG</span>
          </h1>
          <p className="text-xs sm:text-sm text-trigon-400 mt-1">
            Gestão de leilões WhatsApp, enquetes, lotes, controle financeiro consolidado e cobranças em 48h
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefreshAll}
          className="p-2.5 rounded-xl bg-trigon-950 hover:bg-trigon-900 border border-trigon-800 text-trigon-400 hover:text-white transition-all self-start sm:self-center"
          title="Recarregar dados"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-crimson-400' : ''}`} />
        </button>
      </div>

      {/* Navegação por Abas Principais (se não estiver com um leilão individual aberto) */}
      {!selectedAuctionId && (
        <div className="flex items-center gap-2 border-b border-trigon-800 pb-3 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('leiloes')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'leiloes'
                ? 'bg-crimson-600 text-white shadow-glow-crimson'
                : 'bg-trigon-950 text-trigon-400 hover:text-white hover:bg-trigon-900 border border-trigon-800'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Lista de Leilões ({auctions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-crimson-600 text-white shadow-glow-crimson'
                : 'bg-trigon-950 text-trigon-400 hover:text-white hover:bg-trigon-900 border border-trigon-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard Financeiro</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('arremates')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'arremates'
                ? 'bg-crimson-600 text-white shadow-glow-crimson'
                : 'bg-trigon-950 text-trigon-400 hover:text-white hover:bg-trigon-900 border border-trigon-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Arremates & Cobranças ({arremateGroups.length})</span>
          </button>
        </div>
      )}

      {/* Conteúdo Principal */}
      {selectedAuctionId ? (
        <AuctionDetailsView
          auctionId={selectedAuctionId}
          onBack={() => setSelectedAuctionId(null)}
          onOpenAddCardFromStock={handleOpenStockCardPicker}
          onRefreshAuctions={handleRefreshAll}
          refreshTrigger={detailsRefreshTrigger}
        />
      ) : activeTab === 'dashboard' ? (
        <AuctionDashboardTab
          stats={dashboardStats}
          recentAuctions={auctions}
          onOpenAuction={(id) => setSelectedAuctionId(id)}
          onNewAuction={() => setActiveTab('leiloes')}
        />
      ) : activeTab === 'arremates' ? (
        <AuctionArrematesTab
          groups={arremateGroups}
          auctions={auctions}
          onRefresh={loadData}
        />
      ) : (
        <AuctionListTab
          auctions={auctions}
          onSelectAuction={(id) => setSelectedAuctionId(id)}
          onRefresh={loadData}
        />
      )}

      {/* Modal Seletor de Carta do Estoque (Suporte a Carta Única ou Dupla/Combo) */}
      {isStockSelectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-trigon-950 border border-trigon-800 rounded-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-trigon-800">
              <div>
                <h3 className="font-cinzel text-base font-bold text-white flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-crimson-500" />
                  <span>Selecionar Cartas do Estoque para o Leilão</span>
                </h3>
                <p className="text-xs text-trigon-400 mt-0.5">
                  Clique para selecionar 1 carta ou marque várias cartas para montar uma <strong>Dupla ou Combo</strong> no mesmo lote!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStockSelectModalOpen(false)}
                className="text-trigon-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-trigon-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                placeholder="Pesquise por nome da carta, número (ex: 019/196) ou coleção..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredStockVariants.length === 0 ? (
                <div className="p-8 text-center text-xs text-trigon-500">
                  Nenhuma carta com saldo disponível encontrada.
                </div>
              ) : (
                filteredStockVariants.map((v) => {
                  const isChecked = selectedStockVariantIds.includes(v.id);
                  return (
                    <div
                      key={v.id}
                      onClick={() => handleToggleSelectCard(v.id)}
                      className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-crimson-950/40 border-crimson-500/80 shadow-md'
                          : 'bg-trigon-900/60 hover:bg-trigon-850 border-trigon-800 hover:border-crimson-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox */}
                        <div className="text-crimson-400 shrink-0">
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 text-crimson-400" />
                          ) : (
                            <Square className="w-5 h-5 text-trigon-600 hover:text-trigon-400" />
                          )}
                        </div>

                        <div className="w-10 h-14 rounded bg-trigon-950 border border-trigon-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {v.card?.imageUrl ? (
                            <img
                              src={v.card.imageUrl}
                              alt={v.card.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-[10px] text-trigon-600">TCG</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-xs truncate">{v.card?.name}</h4>
                          <span className="text-[11px] text-trigon-400 block truncate">
                            {v.card?.setName} • #{v.card?.localId}{v.card?.totalCards ? `/${v.card.totalCards}` : ''}
                          </span>
                          <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-trigon-300 flex-wrap">
                            <span className="font-semibold text-emerald-400">{v.condition}</span>
                            <span>•</span>
                            <span>{v.language}</span>
                            <span>•</span>
                            <span>{v.finish}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="font-mono text-xs font-bold text-amber-300 block">
                          Saldo: {v.quantity} un.
                        </span>
                        {v.salePrice && (
                          <span className="font-mono text-xs text-emerald-400 block">
                            {formatCurrency(v.salePrice)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCardDirectly(v);
                          }}
                          className="text-[10px] text-crimson-400 hover:text-crimson-300 hover:underline pt-0.5"
                        >
                          Selecionar apenas esta →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Barra Inferior com Ações Rápidas */}
            <div className="pt-3 border-t border-trigon-800 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-trigon-400">
                {selectedStockVariantIds.length === 0 ? (
                  <span>Dica: Clique nas cartas acima para marcar. Marque 2 ou mais para formar uma <strong>Dupla ou Combo</strong>.</span>
                ) : selectedStockVariantIds.length === 1 ? (
                  <span className="text-white font-semibold">1 carta selecionada</span>
                ) : (
                  <span className="text-amber-300 font-bold flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>{selectedStockVariantIds.length} cartas selecionadas para o Combo</span>
                  </span>
                )}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsStockSelectModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-trigon-900 hover:bg-trigon-850 text-xs font-semibold text-white"
                >
                  Cancelar
                </button>

                {selectedStockVariantIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleConfirmStockSelection}
                    className="px-4 py-2 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-xs font-bold text-white shadow-glow-crimson transition-all flex items-center gap-1.5"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    <span>
                      {selectedStockVariantIds.length > 1
                        ? `Criar Dupla / Combo (${selectedStockVariantIds.length} Cartas)`
                        : 'Avançar com 1 Carta'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configurar Lote e Enquete */}
      <AddCardToAuctionModal
        isOpen={isAddCardModalOpen}
        onClose={() => {
          setIsAddCardModalOpen(false);
          setCardVariantForAuction(null);
          setInitialVariantsForAuction([]);
        }}
        variant={cardVariantForAuction}
        initialVariants={initialVariantsForAuction}
        defaultAuctionId={selectedAuctionId || undefined}
        onSuccess={handleRefreshAll}
      />
    </div>
  );
};
