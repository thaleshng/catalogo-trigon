import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TcgdexCardBrief,
  TcgdexSetSummary,
  TcgCard,
  TcgCardVariant,
} from '../../../types';
import { tcgdexService, formatCardNumber } from '../../../services/tcgdexService';
import { Button } from '../../common/Button';
import { Badge } from '../../common/Badge';
import { CardThumbnail } from './CardThumbnail';
import {
  Search,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  PackageCheck,
  AlertCircle,
  Sparkles,
  X,
  ChevronDown,
} from 'lucide-react';

interface TcgdexCatalogSearchProps {
  registeredStockMap: Record<
    string,
    {
      card: TcgCard;
      variants: TcgCardVariant[];
      totalQuantity: number;
    }
  >;
  initialSetId?: string;
  pageSize?: number;
  compact?: boolean;
  onSelectCardForDetails: (cardId: string) => void;
  onQuickAddToStock?: (cardId: string) => void;
  onOpenManualRegister?: () => void;
}

export const TcgdexCatalogSearch: React.FC<TcgdexCatalogSearchProps> = ({
  registeredStockMap,
  initialSetId = '',
  pageSize = 15,
  compact = false,
  onSelectCardForDetails,
  onQuickAddToStock,
  onOpenManualRegister,
}) => {
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [selectedSetId, setSelectedSetId] = useState<string>(initialSetId);
  const [selectedRarity, setSelectedRarity] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Estado do filtro de coleções com pesquisa em texto livre
  const [setSearchText, setSetSearchText] = useState<string>('');
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState<boolean>(false);
  const setDropdownRef = useRef<HTMLDivElement | null>(null);

  const [sets, setSets] = useState<TcgdexSetSummary[]>([]);
  const [rarities, setRarities] = useState<string[]>([]);

  const [cards, setCards] = useState<TcgdexCardBrief[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Contador monotônico para impedir que buscas antigas sobrescrevam resultados mais recentes
  const requestSeqRef = useRef<number>(0);

  // Carrega filtros de edições e raridades da TCGdex
  useEffect(() => {
    let active = true;
    Promise.all([tcgdexService.getSets(), tcgdexService.getRarities()])
      .then(([loadedSets, loadedRarities]) => {
        if (!active) return;
        setSets(loadedSets);
        setRarities(loadedRarities);
      })
      .catch(() => {
        // Ignora silenciosamente se falhar o pré-carregamento de metadados
      });
    return () => {
      active = false;
    };
  }, []);

  // Fecha o dropdown de coleções ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        setDropdownRef.current &&
        !setDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sincroniza initialSetId quando alterado externamente
  useEffect(() => {
    if (initialSetId !== undefined) {
      setSelectedSetId(initialSetId);
      const found = sets.find((s) => s.id === initialSetId);
      setSetSearchText(found ? found.name : '');
      setPage(1);
    }
  }, [initialSetId, sets]);

  // Debounce de 400ms para o campo de busca por nome / número
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Executa a busca na TCGdex sob demanda com proteção contra race conditions
  useEffect(() => {
    const currentSeq = ++requestSeqRef.current;
    const controller = new AbortController();

    setLoading(true);
    setErrorMsg(null);

    tcgdexService
      .searchCards(
        {
          query: debouncedQuery,
          setId: selectedSetId,
          rarity: selectedRarity,
          page,
          pageSize,
        },
        controller.signal
      )
      .then((res) => {
        if (currentSeq !== requestSeqRef.current) return;
        setCards(res.items);
        setTotalResults(res.total);
        setTotalPages(res.totalPages);
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || currentSeq !== requestSeqRef.current) return;
        setErrorMsg(
          err?.message || 'Não foi possível consultar a API TCGdex no momento.'
        );
      })
      .finally(() => {
        if (currentSeq === requestSeqRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, selectedSetId, selectedRarity, page, pageSize]);

  const filteredSets = useMemo(() => {
    const term = setSearchText.trim().toLowerCase();
    if (!term) return sets;
    return sets.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term)
    );
  }, [sets, setSearchText]);

  const handleSelectSet = (setItem: TcgdexSetSummary | null) => {
    if (!setItem) {
      setSelectedSetId('');
      setSetSearchText('');
    } else {
      setSelectedSetId(setItem.id);
      setSetSearchText(setItem.name);
    }
    setIsSetDropdownOpen(false);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedQuery('');
    setSelectedSetId('');
    setSetSearchText('');
    setSelectedRarity('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    searchInput.trim() || selectedSetId || selectedRarity
  );

  return (
    <div className="space-y-4">
      {/* Barra de Pesquisa e Filtros */}
      <div className="bg-trigon-900/70 p-4 rounded-2xl border border-trigon-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Pesquisa por Nome ou Número (Ex: "Charizard", "20/156", "Pikachu 025") */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nome ou número (ex: Charizard, 20/156)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white placeholder-trigon-500 text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>

          {/* Filtro por Coleção com Pesquisa em Texto Livre */}
          <div className="md:col-span-4 relative" ref={setDropdownRef}>
            <div className="relative">
              <input
                type="text"
                value={setSearchText}
                onFocus={() => setIsSetDropdownOpen(true)}
                onChange={(e) => {
                  setSetSearchText(e.target.value);
                  if (selectedSetId && e.target.value.trim() === '') {
                    setSelectedSetId('');
                    setPage(1);
                  }
                  setIsSetDropdownOpen(true);
                }}
                placeholder="Pesquisar coleção (texto livre)..."
                aria-label="Pesquisar coleção por texto livre"
                className="w-full pl-3.5 pr-16 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-trigon-100 placeholder-trigon-500 text-sm focus:outline-none focus:border-crimson-500"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {(setSearchText || selectedSetId) && (
                  <button
                    type="button"
                    onClick={() => handleSelectSet(null)}
                    className="p-1 rounded-md text-trigon-400 hover:text-white hover:bg-trigon-800 transition-colors"
                    title="Limpar coleção selecionada"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSetDropdownOpen((prev) => !prev)}
                  className="p-1 rounded-md text-trigon-400 hover:text-white"
                  aria-label="Abrir lista de coleções"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isSetDropdownOpen && (
              <div className="absolute z-40 mt-1.5 w-full max-h-64 overflow-y-auto rounded-xl bg-trigon-950 border border-trigon-700 shadow-2xl divide-y divide-trigon-850">
                <button
                  type="button"
                  onClick={() => handleSelectSet(null)}
                  className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                    !selectedSetId
                      ? 'bg-crimson-950/70 text-white'
                      : 'text-trigon-300 hover:bg-trigon-900 hover:text-white'
                  }`}
                >
                  Todas as Coleções
                </button>
                {filteredSets.length === 0 ? (
                  <div className="px-3.5 py-3 text-xs text-trigon-500 text-center">
                    Nenhuma coleção encontrada para "{setSearchText}"
                  </div>
                ) : (
                  filteredSets.map((s) => {
                    const isSelected = selectedSetId === s.id;
                    const countLabel =
                      s.cardCount?.official || s.cardCount?.total || null;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectSet(s)}
                        className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between gap-2 transition-colors ${
                          isSelected
                            ? 'bg-crimson-950/70 text-white font-semibold'
                            : 'text-trigon-200 hover:bg-trigon-900 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{s.name}</span>
                        {countLabel && (
                          <span className="text-[10px] font-mono text-trigon-500 shrink-0">
                            {countLabel} cartas
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Filtro por Raridade */}
          <div className="md:col-span-3">
            <select
              value={selectedRarity}
              onChange={(e) => {
                setSelectedRarity(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por raridade"
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-trigon-200 text-sm focus:outline-none focus:border-crimson-500"
            >
              <option value="">Todas as Raridades</option>
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-trigon-400">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-crimson-400" />
            <span>
              {loading ? (
                'Consultando catálogo TCGdex...'
              ) : (
                <>
                  Encontradas <strong className="text-white">{totalResults}</strong> carta(s)
                </>
              )}
            </span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-crimson-400 hover:text-crimson-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabela Responsiva de Resultados */}
      <div className="rounded-2xl bg-trigon-900 border border-trigon-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-trigon-300">
            <thead className="bg-trigon-950/80 border-b border-trigon-800 text-xs uppercase text-trigon-400 font-semibold tracking-wider">
              <tr>
                <th className="px-4 py-3.5 w-16">Carta</th>
                <th className="px-4 py-3.5">Nome</th>
                <th className="px-4 py-3.5">Coleção / Edição</th>
                <th className="px-4 py-3.5">Número</th>
                <th className="px-4 py-3.5">Raridade</th>
                <th className="px-4 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-trigon-800/80">
              {loading ? (
                Array.from({ length: compact ? 5 : 8 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="w-11 h-16 rounded-lg bg-trigon-800" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-36 bg-trigon-800 rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 bg-trigon-800 rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-16 bg-trigon-800 rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-5 w-24 bg-trigon-800 rounded-full" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="h-8 w-28 bg-trigon-800 rounded-lg ml-auto" />
                    </td>
                  </tr>
                ))
              ) : errorMsg ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <AlertCircle className="w-10 h-10 text-crimson-400 mx-auto" />
                      <p className="text-sm font-semibold text-white">
                        Falha ao consultar a API TCGdex
                      </p>
                      <p className="text-xs text-trigon-400">{errorMsg}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPage((p) => p)}
                      >
                        Tentar Novamente
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : cards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <Sparkles className="w-10 h-10 text-trigon-600 mx-auto" />
                      <p className="text-sm font-bold text-white">
                        Nenhuma carta encontrada para os filtros selecionados
                      </p>
                      <p className="text-xs text-trigon-400">
                        Cartas de coleções especiais (ex: Terastal Gathering, 151 Chinesa, Trick or Trade) podem não estar na API mundial da TCGdex.
                      </p>
                      {onOpenManualRegister && (
                        <div className="pt-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={onOpenManualRegister}
                            icon={<Plus className="w-4 h-4 text-emerald-400" />}
                          >
                            Cadastrar Carta Manualmente
                          </Button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                cards.map((card) => {
                  const stockEntry = registeredStockMap[card.id];
                  const formattedNumber = formatCardNumber(card.localId, card.totalCards);

                  return (
                    <tr
                      key={card.id}
                      onClick={() => onSelectCardForDetails(card.id)}
                      className="hover:bg-trigon-850/60 transition-colors cursor-pointer group"
                    >
                      {/* 1. Imagem em miniatura */}
                      <td className="px-4 py-2.5">
                        <CardThumbnail
                          image={card.image}
                          fallbackImage={stockEntry?.card?.imageUrl}
                          alt={card.name}
                          quality="low"
                          size="sm"
                        />
                      </td>

                      {/* 2. Nome e Indicador de Estoque Local (Sem exibir ID) */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white group-hover:text-crimson-300 transition-colors">
                            {card.name}
                          </span>
                          {stockEntry && (
                            <Badge variant="success" size="sm" dot>
                              <span className="inline-flex items-center gap-1">
                                <PackageCheck className="w-3 h-3" />
                                No Estoque ({stockEntry.totalQuantity} un.)
                              </span>
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* 3. Coleção / Edição (Sem exibir Cód) */}
                      <td className="px-4 py-2.5">
                        <span className="text-sm font-medium text-trigon-200 block">
                          {card.setName || 'Não informado'}
                        </span>
                      </td>

                      {/* 4. Número da Carta */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-white bg-trigon-950 px-2.5 py-1 rounded-lg border border-trigon-800">
                          {formattedNumber}
                        </span>
                      </td>

                      {/* 5. Raridade */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {card.rarity ? (
                          <Badge variant="neutral" size="sm">
                            {card.rarity}
                          </Badge>
                        ) : (
                          <span className="text-xs text-trigon-500">Não informado</span>
                        )}
                      </td>

                      {/* 6. Ações */}
                      <td
                        className="px-4 py-2.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => onSelectCardForDetails(card.id)}
                            icon={<Eye className="w-3.5 h-3.5" />}
                          >
                            Detalhes
                          </Button>

                          {onQuickAddToStock && (
                            <Button
                              type="button"
                              size="sm"
                              variant="primary"
                              onClick={() => onQuickAddToStock(card.id)}
                              icon={<Plus className="w-3.5 h-3.5" />}
                            >
                              Estoque
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {!loading && totalPages > 1 && (
          <div className="px-5 py-3.5 bg-trigon-950/70 border-t border-trigon-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-trigon-400">
              Página <strong className="text-white">{page}</strong> de{' '}
              <strong className="text-white">{totalPages}</strong> ({totalResults} cartas)
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                icon={<ChevronLeft className="w-4 h-4" />}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <span>Próxima</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
