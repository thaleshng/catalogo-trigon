import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TcgdexCardDetail,
  TcgCard,
  TcgCardVariant,
} from '../../types';
import { cardStockService } from '../../services/cardStockService';
import { tcgdexService } from '../../services/tcgdexService';
import { Button } from '../../components/common/Button';
import { useToast } from '../../components/common/Toast';
import { TcgdexCatalogSearch } from '../../components/admin/tcg/TcgdexCatalogSearch';
import { CardDetailsModal } from '../../components/admin/tcg/CardDetailsModal';
import { CardVariantFormModal } from '../../components/admin/tcg/CardVariantFormModal';
import { PackageCheck, Sparkles } from 'lucide-react';

export const AdminCardsCatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const { error } = useToast();

  const [registeredStockMap, setRegisteredStockMap] = useState<
    Record<
      string,
      {
        card: TcgCard;
        variants: TcgCardVariant[];
        totalQuantity: number;
      }
    >
  >({});

  // Modal de Detalhes
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  // Modal de Cadastro no Estoque
  const [cardForStock, setCardForStock] = useState<TcgdexCardDetail | null>(null);
  const [customLigaUrlForStock, setCustomLigaUrlForStock] = useState<string | null>(
    null
  );
  const [isStockFormOpen, setIsStockFormOpen] = useState<boolean>(false);

  const loadLocalStockMetadata = useCallback(async () => {
    try {
      const stockMap = await cardStockService.getStockMapByTcgdexId();
      setRegisteredStockMap(stockMap);
    } catch (err) {
      console.error('Erro ao carregar metadados locais de estoque de cartas:', err);
    }
  }, []);

  useEffect(() => {
    loadLocalStockMetadata();
  }, [loadLocalStockMetadata]);

  const handleOpenCardDetails = (cardId: string) => {
    setSelectedCardId(cardId);
    setIsDetailsOpen(true);
  };

  const handleOpenAddFromDetails = (
    detail: TcgdexCardDetail,
    customLigaUrl?: string | null
  ) => {
    setIsDetailsOpen(false);
    setCardForStock(detail);
    setCustomLigaUrlForStock(
      customLigaUrl ||
        registeredStockMap[detail.id]?.card?.ligaPokemonUrl ||
        null
    );
    setIsStockFormOpen(true);
  };

  const handleQuickAddFromRow = async (cardId: string) => {
    try {
      const detail = await tcgdexService.getCardById(cardId);
      setCardForStock(detail);
      setCustomLigaUrlForStock(
        registeredStockMap[cardId]?.card?.ligaPokemonUrl || null
      );
      setIsStockFormOpen(true);
    } catch (err: any) {
      error(
        err?.message || 'Não foi possível carregar os dados da carta para cadastro.'
      );
    }
  };

  const handleViewInStock = (tcgdexId: string) => {
    setIsDetailsOpen(false);
    setIsStockFormOpen(false);
    const cardName =
      registeredStockMap[tcgdexId]?.card?.name || cardForStock?.name || '';
    navigate(
      `/admin/estoque-cartas${
        cardName ? `?search=${encodeURIComponent(cardName)}` : ''
      }`
    );
  };

  const totalRegisteredCards = Object.keys(registeredStockMap).length;
  const totalUnitsInStock = Object.values(registeredStockMap).reduce(
    (acc, item) => acc + item.totalQuantity,
    0
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-crimson-500" />
            <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
              Cartas TCG (Catálogo)
            </h1>
          </div>
          <p className="text-sm text-trigon-400 mt-1">
            Pesquise cartas Pokémon por nome ou número (ex: 20/156) e adicione diretamente ao estoque
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-trigon-900 border border-trigon-800 text-xs text-trigon-300">
            <PackageCheck className="w-4 h-4 text-emerald-400" />
            <span>
              <strong className="text-white">{totalRegisteredCards}</strong> carta(s) •{' '}
              <strong className="text-emerald-400">{totalUnitsInStock}</strong> un. em estoque
            </span>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate('/admin/estoque-cartas')}
            icon={<PackageCheck className="w-4 h-4 text-emerald-400" />}
          >
            Ir para Estoque de Cartas
          </Button>
        </div>
      </div>

      {/* Componente Compartilhado de Pesquisa e Listagem da TCGdex */}
      <TcgdexCatalogSearch
        registeredStockMap={registeredStockMap}
        onSelectCardForDetails={handleOpenCardDetails}
        onQuickAddToStock={handleQuickAddFromRow}
      />

      {/* Modal de Detalhes da Carta */}
      <CardDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        cardId={selectedCardId}
        registeredStock={
          selectedCardId ? registeredStockMap[selectedCardId] || null : null
        }
        onAddToStock={handleOpenAddFromDetails}
        onViewInStock={handleViewInStock}
        onStockUpdated={loadLocalStockMetadata}
      />

      {/* Modal de Cadastro de Variante no Estoque */}
      <CardVariantFormModal
        isOpen={isStockFormOpen}
        onClose={() => setIsStockFormOpen(false)}
        cardDetail={cardForStock}
        customLigaUrl={customLigaUrlForStock}
        onSuccess={() => {
          loadLocalStockMetadata();
        }}
        onOpenInStock={handleViewInStock}
      />
    </div>
  );
};
