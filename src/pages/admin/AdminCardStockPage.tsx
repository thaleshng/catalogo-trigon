import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Collection,
  Category,
  TcgdexCardDetail,
  TcgCard,
  TcgCardVariant,
  TcgCardStockMovement,
  TcgCardStockMovementType,
} from '../../types';
import { collectionService } from '../../services/collectionService';
import { categoryService } from '../../services/categoryService';
import { cardStockService } from '../../services/cardStockService';
import {
  tcgdexService,
  formatCardNumber,
  matchesCardQuery,
} from '../../services/tcgdexService';
import {
  getCardConditionOptions,
  getCardLanguageOptions,
  buildLigaPokemonUrl,
} from '../../config/tcgCardOptions';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { useToast } from '../../components/common/Toast';
import { CardThumbnail } from '../../components/admin/tcg/CardThumbnail';
import {
  CardConditionBadge,
  CardLanguageBadge,
  CardFinishBadge,
} from '../../components/admin/tcg/CardAttributeBadges';
import { TcgdexCatalogSearch } from '../../components/admin/tcg/TcgdexCatalogSearch';
import { CardDetailsModal } from '../../components/admin/tcg/CardDetailsModal';
import { CardVariantFormModal } from '../../components/admin/tcg/CardVariantFormModal';
import { CardStockMovementModal } from '../../components/admin/tcg/CardStockMovementModal';
import { CardVariantEditModal } from '../../components/admin/tcg/CardVariantEditModal';
import { CardManualRegisterModal } from '../../components/admin/tcg/CardManualRegisterModal';
import { AddCardToAuctionModal } from '../../components/admin/tcg/auction/AddCardToAuctionModal';
import {
  Plus,
  Search,
  RotateCcw,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  ExternalLink,
  Link2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FolderKanban,
  Package,
  Calendar,
  X,
  Gavel,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export const AdminCardStockPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { success, error } = useToast();

  const initialUrlSearch = searchParams.get('search') || '';

  // Dados do estoque de cartas e linhas/coleções do site (para vínculo comercial opcional)
  const [variants, setVariants] = useState<TcgCardVariant[]>([]);
  const [movements, setMovements] = useState<TcgCardStockMovement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
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
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros do estoque (Nome/Número, Coleção da Carta em texto livre, Condição, Idioma)
  const [filterName, setFilterName] = useState<string>(initialUrlSearch);
  const [filterSetName, setFilterSetName] = useState<string>('');
  const [setFilterInput, setSetFilterInput] = useState<string>('');
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState<boolean>(false);
  const setDropdownRef = useRef<HTMLDivElement | null>(null);

  const [filterCondition, setFilterCondition] = useState<string>('');
  const [filterLanguage, setFilterLanguage] = useState<string>('');
  const [filterOrigin, setFilterOrigin] = useState<'ALL' | 'MANUAL' | 'TCGDEX'>('ALL');

  // Agrupamento visual opcional por carta-base
  const [groupByCard, setGroupByCard] = useState<boolean>(false);
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  // Paginação do estoque de cartas / variantes
  const [stockPage, setStockPage] = useState<number>(1);
  const [stockPerPage, setStockPerPage] = useState<number>(25);

  // Histórico de Movimentações (Collapse & Paginação)
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(false); // Padrão: collapsado
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPerPage, setHistoryPerPage] = useState<number>(10);

  // Modal de Busca TCGdex dentro do Estoque ("Adicionar Cartas")
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState<boolean>(false);
  const [isManualRegisterModalOpen, setIsManualRegisterModalOpen] = useState<boolean>(false);

  // Modal de Detalhes da Carta
  const [detailsCardId, setDetailsCardId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);

  // Modal de Cadastro de Variante
  const [cardForVariantForm, setCardForVariantForm] = useState<TcgdexCardDetail | null>(
    null
  );
  const [customLigaUrlForForm, setCustomLigaUrlForForm] = useState<string | null>(
    null
  );
  const [isVariantFormOpen, setIsVariantFormOpen] = useState<boolean>(false);

  // Modal de Movimentação de Estoque
  const [movementTargetVariant, setMovementTargetVariant] =
    useState<TcgCardVariant | null>(null);
  const [movementDefaultType, setMovementDefaultType] =
    useState<TcgCardStockMovementType>('ENTRADA');
  const [isMovementModalOpen, setIsMovementModalOpen] = useState<boolean>(false);

  // Modal de Edição Financeira, Vínculo Comercial & Lotes da Variante
  const [editTargetVariant, setEditTargetVariant] = useState<TcgCardVariant | null>(
    null
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Modal de Vínculo Comercial Rápido (ícone de vínculo no final da linha)
  const [linkTargetVariant, setLinkTargetVariant] = useState<TcgCardVariant | null>(
    null
  );
  const [selectedLinkValue, setSelectedLinkValue] = useState<string>('');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [savingLink, setSavingLink] = useState<boolean>(false);

  // Modal de Adicionar ao Leilão / Pré-Leilão
  const [auctionTargetVariant, setAuctionTargetVariant] = useState<TcgCardVariant | null>(
    null
  );
  const [isAddToAuctionModalOpen, setIsAddToAuctionModalOpen] = useState<boolean>(false);

  // Modal de Confirmação de Exclusão de Variante
  const [variantToDelete, setVariantToDelete] = useState<TcgCardVariant | null>(null);
  const [isDeletingVariant, setIsDeletingVariant] = useState<boolean>(false);

  // Menu dropdown de Ações com posicionamento fixo (imune ao overflow da tabela)
  const [actionMenuState, setActionMenuState] = useState<{
    variant: TcgCardVariant;
    top: number;
    right: number;
    openUpwards: boolean;
  } | null>(null);

  const handleToggleActionMenu = (e: React.MouseEvent, variant: TcgCardVariant) => {
    e.stopPropagation();
    if (actionMenuState?.variant.id === variant.id) {
      setActionMenuState(null);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < menuHeight && rect.top > menuHeight;

    setActionMenuState({
      variant,
      top: openUpwards ? Math.max(10, rect.top - menuHeight - 6) : rect.bottom + 6,
      right: Math.max(16, window.innerWidth - rect.right),
      openUpwards,
    });
  };

  // Fecha o menu de ações ao clicar fora, rolar a página ou pressionar ESC
  useEffect(() => {
    if (!actionMenuState) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-stock-action-menu]')) {
        setActionMenuState(null);
      }
    };
    const handleScrollOrResize = () => {
      setActionMenuState(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActionMenuState(null);
      }
    };

    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [actionMenuState]);

  // Ocultar cartas com saldo 0 por padrão para enxugar a listagem
  const [hideOutOfStock, setHideOutOfStock] = useState<boolean>(true);

  const conditionOptions = getCardConditionOptions();
  const languageOptions = getCardLanguageOptions();

  const loadStockData = useCallback(async () => {
    try {
      setLoading(true);
      const [vars, movs, stockMap, cats, cols] = await Promise.all([
        cardStockService.getVariants(),
        cardStockService.getMovements({ limit: 200 }),
        cardStockService.getStockMapByTcgdexId(),
        categoryService.getCategories(false),
        collectionService.getCollections(false),
      ]);
      setVariants(vars);
      setMovements(movs);
      setRegisteredStockMap(stockMap);
      setCategories(cats);
      setCollections(cols);
    } catch (err) {
      console.error('Erro ao carregar estoque de cartas:', err);
      error('Erro ao carregar a lista de estoque de cartas.');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadStockData();
  }, [loadStockData]);

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch) {
      setFilterName(urlSearch);
    }
  }, [searchParams]);

  // Fecha o dropdown de coleção ao clicar fora
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

  // Lista única de coleções das cartas cadastradas no estoque
  const distinctCardSets = useMemo(() => {
    const setNames = new Set<string>();
    for (const v of variants) {
      if (v.card?.setName && v.card.setName !== 'Não informado') {
        setNames.add(v.card.setName);
      }
    }
    return Array.from(setNames).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [variants]);

  const filteredSetOptions = useMemo(() => {
    const term = setFilterInput.trim().toLowerCase();
    if (!term) return distinctCardSets;
    return distinctCardSets.filter((name) => name.toLowerCase().includes(term));
  }, [distinctCardSets, setFilterInput]);

  // Contagem de cartas com estoque zerado
  const outOfStockCount = useMemo(
    () => variants.filter((v) => v.quantity <= 0).length,
    [variants]
  );

  // Filtragem local das variantes (Nome/Número tipo "20/156", Coleção da carta, Condição, Idioma, Ocultar saldo 0)
  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      if (hideOutOfStock && v.quantity <= 0) {
        return false;
      }
      const isManual = Boolean(
        v.card?.tcgdexId?.startsWith('manual-') ||
        (v.card?.metadata as any)?.isManual
      );
      if (filterOrigin === 'MANUAL' && !isManual) {
        return false;
      }
      if (filterOrigin === 'TCGDEX' && isManual) {
        return false;
      }
      if (filterCondition && v.condition !== filterCondition) {
        return false;
      }
      if (filterLanguage && v.language !== filterLanguage) {
        return false;
      }
      if (filterSetName && v.card?.setName !== filterSetName) {
        return false;
      } else if (
        !filterSetName &&
        setFilterInput.trim() !== '' &&
        !(v.card?.setName || '')
          .toLowerCase()
          .includes(setFilterInput.trim().toLowerCase())
      ) {
        return false;
      }

      if (filterName.trim() !== '' && !matchesCardQuery(filterName, v.card)) {
        return false;
      }

      return true;
    });
  }, [
    variants,
    hideOutOfStock,
    filterName,
    filterSetName,
    setFilterInput,
    filterCondition,
    filterLanguage,
    filterOrigin,
  ]);

  // Agrupamento opcional por carta-base
  const groupedCards = useMemo(() => {
    const map = new Map<
      string,
      {
        card: TcgCard;
        variants: TcgCardVariant[];
        totalQuantity: number;
      }
    >();

    for (const v of filteredVariants) {
      if (!v.card) continue;
      const existing = map.get(v.card.id);
      if (existing) {
        existing.variants.push(v);
        existing.totalQuantity += v.quantity;
      } else {
        map.set(v.card.id, {
          card: v.card,
          variants: [v],
          totalQuantity: v.quantity,
        });
      }
    }

    return Array.from(map.values());
  }, [filteredVariants]);

  const totalUnitsInStock = useMemo(
    () => variants.reduce((acc, v) => acc + v.quantity, 0),
    [variants]
  );

  // Reset da página de cartas ao alterar filtros ou modo de agrupamento
  useEffect(() => {
    setStockPage(1);
  }, [
    filterName,
    filterSetName,
    setFilterInput,
    filterCondition,
    filterLanguage,
    filterOrigin,
    hideOutOfStock,
    groupByCard,
  ]);

  const totalStockItems = groupByCard ? groupedCards.length : filteredVariants.length;
  const totalStockPages = Math.max(1, Math.ceil(totalStockItems / stockPerPage));

  const paginatedVariants = useMemo(() => {
    const start = (stockPage - 1) * stockPerPage;
    return filteredVariants.slice(start, start + stockPerPage);
  }, [filteredVariants, stockPage, stockPerPage]);

  const paginatedGroupedCards = useMemo(() => {
    const start = (stockPage - 1) * stockPerPage;
    return groupedCards.slice(start, start + stockPerPage);
  }, [groupedCards, stockPage, stockPerPage]);

  const totalHistoryItems = movements.length;
  const totalHistoryPages = Math.max(1, Math.ceil(totalHistoryItems / historyPerPage));

  const paginatedMovements = useMemo(() => {
    const start = (historyPage - 1) * historyPerPage;
    return movements.slice(start, start + historyPerPage);
  }, [movements, historyPage, historyPerPage]);

  const getCategoryName = (catId?: string | null) => {
    if (!catId) return null;
    return categories.find((c) => c.id === catId)?.name || null;
  };

  const getCollectionName = (colId?: string | null) => {
    if (!colId) return null;
    return collections.find((c) => c.id === colId)?.name || null;
  };

  const handleOpenLinkModal = (variant: TcgCardVariant) => {
    setLinkTargetVariant(variant);
    const currentVal = variant.categoryId
      ? `cat:${variant.categoryId}`
      : variant.collectionId
        ? `col:${variant.collectionId}`
        : '';
    setSelectedLinkValue(currentVal);
    setIsLinkModalOpen(true);
  };

  const handleSaveCommercialLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTargetVariant) return;

    try {
      setSavingLink(true);
      let categoryId: string | null = null;
      let collectionId: string | null = null;

      if (selectedLinkValue.startsWith('cat:')) {
        categoryId = selectedLinkValue.replace('cat:', '');
      } else if (selectedLinkValue.startsWith('col:')) {
        collectionId = selectedLinkValue.replace('col:', '');
      }

      const updated = await cardStockService.updateVariantDetails(
        linkTargetVariant.id,
        {
          categoryId,
          collectionId,
        }
      );

      setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      success('Vínculo comercial atualizado com sucesso!');
      setIsLinkModalOpen(false);
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar vínculo comercial');
    } finally {
      setSavingLink(false);
    }
  };

  const handleOpenMovementModal = (
    variant: TcgCardVariant,
    defaultType: TcgCardStockMovementType = 'ENTRADA'
  ) => {
    setMovementTargetVariant(variant);
    setMovementDefaultType(defaultType);
    setIsMovementModalOpen(true);
  };

  const handleOpenEditModal = (variant: TcgCardVariant) => {
    setEditTargetVariant(variant);
    setIsEditModalOpen(true);
  };

  const handleOpenAuctionModal = (variant: TcgCardVariant) => {
    setAuctionTargetVariant(variant);
    setIsAddToAuctionModalOpen(true);
  };

  const handleOpenDeleteModal = (variant: TcgCardVariant) => {
    setVariantToDelete(variant);
  };

  const handleConfirmDeleteVariant = async () => {
    if (!variantToDelete) return;
    const cardName = variantToDelete.card?.name || 'Carta';
    try {
      setIsDeletingVariant(true);
      await cardStockService.deleteVariant(variantToDelete.id);
      success(`Variante de "${cardName}" excluída do estoque com sucesso!`);
      setVariantToDelete(null);
      loadStockData();
    } catch (err: any) {
      error(err?.message || 'Erro ao excluir variante do estoque.');
    } finally {
      setIsDeletingVariant(false);
    }
  };

  const handleOpenCardDetails = (tcgdexId: string) => {
    setDetailsCardId(tcgdexId);
    setIsDetailsModalOpen(true);
  };

  const handleQuickAddFromCatalogModal = async (cardId: string) => {
    try {
      const detail = await tcgdexService.getCardById(cardId);
      setIsCatalogModalOpen(false);
      setCardForVariantForm(detail);
      setCustomLigaUrlForForm(
        registeredStockMap[cardId]?.card?.ligaPokemonUrl || null
      );
      setIsVariantFormOpen(true);
    } catch (err: any) {
      error(err?.message || 'Erro ao carregar dados da carta selecionada');
    }
  };

  const handleAddFromDetailsModal = (
    detail: TcgdexCardDetail,
    customLigaUrl?: string | null
  ) => {
    setIsDetailsModalOpen(false);
    setIsCatalogModalOpen(false);
    setCardForVariantForm(detail);
    setCustomLigaUrlForForm(
      customLigaUrl ||
        registeredStockMap[detail.id]?.card?.ligaPokemonUrl ||
        null
    );
    setIsVariantFormOpen(true);
  };

  const handleClearFilters = () => {
    setFilterName('');
    setFilterSetName('');
    setSetFilterInput('');
    setFilterCondition('');
    setFilterLanguage('');
    setFilterOrigin('ALL');
    if (searchParams.has('search')) {
      setSearchParams({});
    }
  };

  const hasActiveStockFilters = Boolean(
    filterName.trim() ||
      filterSetName ||
      setFilterInput.trim() ||
      filterCondition ||
      filterLanguage ||
      filterOrigin !== 'ALL'
  );

  const renderVariantRow = (
    variant: TcgCardVariant,
    indented: boolean = false
  ) => {
    const card = variant.card;
    const formattedNumber = formatCardNumber(card?.localId, card?.totalCards);

    const linkedCategoryName = getCategoryName(variant.categoryId);
    const linkedCollectionName = getCollectionName(variant.collectionId);
    const hasCommercialLink = Boolean(linkedCategoryName || linkedCollectionName);

    return (
      <tr
        key={variant.id}
        className={`hover:bg-trigon-850/60 transition-colors ${
          indented ? 'bg-trigon-950/50' : ''
        } ${actionMenuState?.variant.id === variant.id ? 'relative z-30' : ''}`}
      >
        {/* 1. Miniatura + Nome */}
        <td className={`px-3.5 py-3 ${indented ? 'pl-8' : ''}`}>
          <div className="flex items-center gap-2.5">
            <CardThumbnail
              image={card?.imageUrl}
              alt={card?.name || 'Carta'}
              quality="low"
              size="sm"
              onClick={() => card && handleOpenCardDetails(card.tcgdexId)}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => card && handleOpenCardDetails(card.tcgdexId)}
                  className="font-bold text-white hover:text-crimson-300 text-left truncate block max-w-[160px]"
                >
                  {card?.name || 'Carta TCG'}
                </button>
                {card?.tcgdexId?.startsWith('manual-') && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300 shrink-0">
                    ✍️ Manual
                  </span>
                )}
              </div>
              {card?.rarity && (
                <span className="text-[11px] text-trigon-400 block truncate max-w-[160px]">
                  {card.rarity}
                </span>
              )}
              {variant.notes && (
                <span
                  className="text-[10px] text-trigon-500 italic block truncate max-w-[160px]"
                  title={variant.notes}
                >
                  Obs: {variant.notes}
                </span>
              )}
            </div>
          </div>
        </td>

        {/* 2. Coleção da Carta */}
        <td className="px-3.5 py-3">
          <span className="text-xs font-semibold text-white block truncate max-w-[160px]" title={card?.setName}>
            {card?.setName || 'Não informado'}
          </span>
          {hasCommercialLink && (
            <span
              className="text-[10px] text-amber-400 block truncate max-w-[160px]"
              title={
                linkedCategoryName
                  ? `Linha: ${linkedCategoryName}`
                  : `Coleção: ${linkedCollectionName}`
              }
            >
              {linkedCategoryName || linkedCollectionName}
            </span>
          )}
        </td>

        {/* 3. Número */}
        <td className="px-3.5 py-3 whitespace-nowrap">
          <span className="font-mono text-xs font-semibold text-white bg-trigon-950 px-2 py-1 rounded-lg border border-trigon-800">
            {formattedNumber}
          </span>
        </td>

        {/* 4. Condição (Sigla) */}
        <td className="px-3.5 py-3 whitespace-nowrap">
          <CardConditionBadge value={variant.condition} size="sm" useShortLabel />
        </td>

        {/* 5. Idioma */}
        <td className="px-3.5 py-3 whitespace-nowrap">
          <CardLanguageBadge value={variant.language} size="sm" />
        </td>

        {/* 6. Acabamento */}
        <td className="px-3.5 py-3 whitespace-nowrap">
          <CardFinishBadge value={variant.finish} size="sm" />
        </td>

        {/* 7. Quantidade */}
        <td className="px-3.5 py-3 whitespace-nowrap">
          {variant.quantity === 0 ? (
            <Badge variant="danger" size="sm" dot>
              0 un.
            </Badge>
          ) : variant.quantity <= 2 ? (
            <Badge variant="warning" size="sm" dot>
              {variant.quantity} un.
            </Badge>
          ) : (
            <Badge variant="success" size="sm" dot>
              {variant.quantity} un.
            </Badge>
          )}
        </td>

        {/* 8. Valor de Referência (Opcional) com Tooltip de Data no Ícone */}
        <td className="px-3.5 py-3 whitespace-nowrap">
          {variant.referenceValue !== null && variant.referenceValue !== undefined ? (
            <div className="inline-flex items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-amber-300">
                {formatCurrency(variant.referenceValue)}
              </span>
              {variant.referenceDate && (
                <div
                  className="group relative inline-flex items-center text-amber-400/80 hover:text-amber-300 transition-colors cursor-help"
                  title={`Data da referência: ${formatDate(variant.referenceDate)}`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  {/* Tooltip moderno no hover */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex items-center gap-1 px-2 py-1 rounded-md bg-trigon-950 border border-trigon-700 text-[11px] font-medium text-trigon-100 shadow-xl whitespace-nowrap z-30">
                    <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Data ref.: {formatDate(variant.referenceDate)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-trigon-500">—</span>
          )}
        </td>

        {/* 9. Preço de Venda (Opcional) */}
        <td className="px-3.5 py-3 whitespace-nowrap">
          {variant.salePrice !== null && variant.salePrice !== undefined ? (
            <span className="font-mono text-sm font-bold text-emerald-400">
              {formatCurrency(variant.salePrice)}
            </span>
          ) : (
            <span className="text-xs text-trigon-500">—</span>
          )}
        </td>

        {/* 10. Ações: Botão Disparador do Menu Flutuante */}
        <td className="px-3.5 py-3 text-right whitespace-nowrap">
          <button
            type="button"
            data-stock-action-menu
            onClick={(e) => handleToggleActionMenu(e, variant)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              actionMenuState?.variant.id === variant.id
                ? 'bg-crimson-900/80 border-crimson-500 text-white shadow-sm ring-1 ring-crimson-500/50'
                : 'bg-trigon-950 hover:bg-trigon-800 border-trigon-800 hover:border-trigon-700 text-trigon-200 hover:text-white'
            }`}
            title="Abrir opções de ações para esta carta"
          >
            <span>Ações</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-trigon-400 transition-transform ${
                actionMenuState?.variant.id === variant.id ? 'rotate-180 text-white' : ''
              }`}
            />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Estoque de Cartas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
            Estoque de Cartas TCG
          </h1>
          <p className="text-sm text-trigon-400 mt-1">
            Controle interno de cartas por variante (condição, idioma e acabamento), mantendo a coleção de origem da carta
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsManualRegisterModalOpen(true)}
            icon={<Plus className="w-4 h-4 text-emerald-400" />}
          >
            Cadastrar Manual
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsCatalogModalOpen(true)}
            icon={<Search className="w-4 h-4" />}
          >
            Buscar no Catálogo
          </Button>
        </div>
      </div>

      {/* Barra de Filtros da Listagem de Estoque */}
      <div className="bg-trigon-900/70 p-4 rounded-2xl border border-trigon-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* 1. Busca por Nome ou Número (Ex: "Charizard", "20/156") */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Buscar por nome ou número (ex: 20/156)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white placeholder-trigon-500 text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>

          {/* 2. Filtro por Coleção da Carta (Texto livre) */}
          <div className="md:col-span-3 relative" ref={setDropdownRef}>
            <div className="relative">
              <input
                type="text"
                value={setFilterInput}
                onFocus={() => setIsSetDropdownOpen(true)}
                onChange={(e) => {
                  setSetFilterInput(e.target.value);
                  setFilterSetName('');
                  setIsSetDropdownOpen(true);
                }}
                placeholder="Filtrar coleção (texto livre)..."
                className="w-full pl-3.5 pr-14 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-trigon-100 placeholder-trigon-500 text-sm focus:outline-none focus:border-crimson-500"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {(setFilterInput || filterSetName) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSetName('');
                      setSetFilterInput('');
                      setIsSetDropdownOpen(false);
                    }}
                    className="p-1 rounded-md text-trigon-400 hover:text-white"
                    title="Limpar filtro de coleção"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSetDropdownOpen((prev) => !prev)}
                  className="p-1 rounded-md text-trigon-400 hover:text-white"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isSetDropdownOpen && (
              <div className="absolute z-40 mt-1.5 w-full max-h-56 overflow-y-auto rounded-xl bg-trigon-950 border border-trigon-700 shadow-2xl divide-y divide-trigon-850">
                <button
                  type="button"
                  onClick={() => {
                    setFilterSetName('');
                    setSetFilterInput('');
                    setIsSetDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold ${
                    !filterSetName
                      ? 'bg-crimson-950/70 text-white'
                      : 'text-trigon-300 hover:bg-trigon-900'
                  }`}
                >
                  Todas as Coleções
                </button>
                {filteredSetOptions.map((setName) => (
                  <button
                    key={setName}
                    type="button"
                    onClick={() => {
                      setFilterSetName(setName);
                      setSetFilterInput(setName);
                      setIsSetDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs transition-colors ${
                      filterSetName === setName
                        ? 'bg-crimson-950/70 text-white font-semibold'
                        : 'text-trigon-200 hover:bg-trigon-900 hover:text-white'
                    }`}
                  >
                    {setName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Filtro por Condição */}
          <div className="md:col-span-2">
            <select
              value={filterCondition}
              onChange={(e) => setFilterCondition(e.target.value)}
              aria-label="Filtrar estoque por condição"
              className="w-full px-3 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-trigon-200 text-sm focus:outline-none focus:border-crimson-500"
            >
              <option value="">Todas as Condições</option>
              {conditionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Filtro por Idioma */}
          <div className="md:col-span-2">
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
              aria-label="Filtrar estoque por idioma"
              className="w-full px-3 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-trigon-200 text-sm focus:outline-none focus:border-crimson-500"
            >
              <option value="">Todos os Idiomas</option>
              {languageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Alternar Agrupamento Visual por Carta */}
          <div className="md:col-span-1 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setGroupByCard((prev) => !prev)}
              className={`w-full px-2.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                groupByCard
                  ? 'bg-crimson-950/80 border-crimson-500 text-white'
                  : 'bg-trigon-950 border-trigon-750 text-trigon-300 hover:text-white'
              }`}
              title="Agrupar visualmente variantes da mesma carta"
            >
              <FolderKanban className="w-4 h-4 text-crimson-400 shrink-0" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-trigon-400 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Exibindo <strong className="text-white">{filteredVariants.length}</strong> de{' '}
              <strong className="text-white">{variants.length}</strong> variante(s) • Total em estoque:{' '}
              <strong className="text-emerald-400 font-mono">{totalUnitsInStock} un.</strong>
            </span>

            {/* Toggle Ocultar / Exibir Saldo 0 */}
            <button
              type="button"
              onClick={() => setHideOutOfStock((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                hideOutOfStock
                  ? 'bg-trigon-950 border-trigon-750 text-trigon-300 hover:text-white hover:border-trigon-650'
                  : 'bg-amber-950/70 border-amber-500/50 text-amber-300 hover:bg-amber-900/60'
              }`}
              title={
                hideOutOfStock
                  ? 'Clique para exibir cartas com 0 unidades em estoque'
                  : 'Clique para ocultar cartas com 0 unidades em estoque'
              }
            >
              {hideOutOfStock ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ocultando Saldo 0 ({outOfStockCount})</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exibindo Saldo 0 ({outOfStockCount})</span>
                </>
              )}
            </button>

            {/* Filtro de Origem: Todas / ✍️ Manuais / 🌐 TCGdex */}
            <div className="inline-flex rounded-lg bg-trigon-950 p-0.5 border border-trigon-750 text-xs">
              <button
                type="button"
                onClick={() => setFilterOrigin('ALL')}
                className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                  filterOrigin === 'ALL'
                    ? 'bg-crimson-600 text-white shadow-sm font-semibold'
                    : 'text-trigon-400 hover:text-white'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFilterOrigin('MANUAL')}
                className={`px-2 py-0.5 rounded-md font-medium transition-all flex items-center gap-1 ${
                  filterOrigin === 'MANUAL'
                    ? 'bg-amber-600 text-white shadow-sm font-bold'
                    : 'text-amber-400 hover:text-amber-300'
                }`}
                title="Exibir apenas cartas cadastradas manualmente"
              >
                <span>✍️</span> Manuais
              </button>
              <button
                type="button"
                onClick={() => setFilterOrigin('TCGDEX')}
                className={`px-2 py-0.5 rounded-md font-medium transition-all flex items-center gap-1 ${
                  filterOrigin === 'TCGDEX'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-blue-400 hover:text-blue-300'
                }`}
                title="Exibir apenas cartas originárias do catálogo TCGdex"
              >
                <span>🌐</span> TCGdex
              </button>
            </div>
          </div>

          {hasActiveStockFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-crimson-400 hover:text-crimson-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Variantes em Estoque */}
      <div className="rounded-2xl bg-trigon-900 border border-trigon-800 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-trigon-300">
            <thead className="bg-trigon-950/80 border-b border-trigon-800 text-xs uppercase text-trigon-400 font-semibold tracking-wider">
              <tr>
                <th className="px-3.5 py-3.5">Carta</th>
                <th className="px-3.5 py-3.5">Coleção</th>
                <th className="px-3.5 py-3.5">Número</th>
                <th className="px-3.5 py-3.5">Condição</th>
                <th className="px-3.5 py-3.5">Idioma</th>
                <th className="px-3.5 py-3.5">Acabamento</th>
                <th className="px-3.5 py-3.5">Quantidade</th>
                <th className="px-3.5 py-3.5">Valor Ref.</th>
                <th className="px-3.5 py-3.5">Preço Venda</th>
                <th className="px-3.5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-trigon-800/80">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-trigon-500">
                    Carregando estoque de cartas...
                  </td>
                </tr>
              ) : filteredVariants.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-14 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <Package className="w-10 h-10 text-trigon-600 mx-auto" />
                      <p className="text-sm font-bold text-white">
                        {variants.length === 0
                          ? 'Nenhuma carta cadastrada no estoque ainda'
                          : 'Nenhuma variante corresponde aos filtros aplicados'}
                      </p>
                      <p className="text-xs text-trigon-400">
                        {variants.length === 0
                          ? 'Clique em "Adicionar Cartas" acima para pesquisar no catálogo TCGdex e registrar a primeira carta.'
                          : 'Experimente limpar os filtros de busca, coleção, condição ou idioma.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : groupByCard ? (
                paginatedGroupedCards.map((group) => {
                  const isExpanded = expandedCardIds[group.card.id] ?? true;
                  const formattedNumber = formatCardNumber(
                    group.card.localId,
                    group.card.totalCards
                  );

                  return (
                    <React.Fragment key={group.card.id}>
                      <tr
                        onClick={() =>
                          setExpandedCardIds((prev) => ({
                            ...prev,
                            [group.card.id]: !isExpanded,
                          }))
                        }
                        className="bg-trigon-950/90 hover:bg-trigon-950 cursor-pointer border-b border-trigon-800"
                      >
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-crimson-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-trigon-400" />
                            )}
                            <span className="font-bold text-white">
                              {group.card.name}
                            </span>
                            {group.card.tcgdexId?.startsWith('manual-') && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300">
                                ✍️ Manual
                              </span>
                            )}
                            <span className="text-xs text-trigon-300">
                              • {group.card.setName}
                            </span>
                            <span className="font-mono text-xs text-trigon-400">
                              #{formattedNumber}
                            </span>
                            <Badge variant="neutral" size="sm">
                              {group.variants.length} variante(s)
                            </Badge>
                          </div>
                        </td>
                        <td colSpan={4} className="px-4 py-3 text-right">
                          <span className="text-xs text-trigon-400">
                            Total das variantes:{' '}
                            <strong className="text-emerald-400 font-mono">
                              {group.totalQuantity} un.
                            </strong>
                          </span>
                        </td>
                      </tr>
                      {isExpanded &&
                        group.variants.map((v) => renderVariantRow(v, true))}
                    </React.Fragment>
                  );
                })
              ) : (
                paginatedVariants.map((v) => renderVariantRow(v, false))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação da Tabela de Cartas */}
        <Pagination
          currentPage={stockPage}
          totalPages={totalStockPages}
          totalItems={totalStockItems}
          itemsPerPage={stockPerPage}
          onPageChange={setStockPage}
          onItemsPerPageChange={(limit) => {
            setStockPerPage(limit);
            setStockPage(1);
          }}
          itemsPerPageOptions={[15, 25, 50, 100]}
          itemLabel={groupByCard ? 'carta(s)' : 'variante(s)'}
        />
      </div>

      {/* Histórico de Movimentações de Cartas (Collapse & Expand com Paginação) */}
      <div className="space-y-4 pt-4">
        <div
          onClick={() => setIsHistoryExpanded((prev) => !prev)}
          className="flex items-center justify-between p-4 rounded-2xl bg-trigon-900 border border-trigon-800 hover:bg-trigon-850/80 cursor-pointer transition-all select-none shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-trigon-950 border border-trigon-750 flex items-center justify-center text-crimson-400 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-lg font-bold text-white flex items-center gap-2">
                <span>Histórico de Movimentações de Cartas</span>
              </h2>
              <p className="text-xs text-trigon-400">
                Registro detalhado de entradas, saídas e ajustes no estoque
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-trigon-950 border border-trigon-800 text-trigon-300">
              {movements.length} registro(s) recente(s)
            </span>
            <div className="p-1.5 rounded-lg text-trigon-400 hover:text-white transition-colors">
              {isHistoryExpanded ? (
                <ChevronUp className="w-5 h-5 text-crimson-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-trigon-400" />
              )}
            </div>
          </div>
        </div>

        {isHistoryExpanded && (
          <div className="rounded-2xl bg-trigon-900 border border-trigon-800 overflow-hidden shadow-lg animate-in fade-in-50 duration-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-trigon-300">
                <thead className="bg-trigon-950/80 border-b border-trigon-800 text-xs uppercase text-trigon-400 font-semibold tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Data e Hora</th>
                    <th className="px-5 py-3.5">Carta & Variante</th>
                    <th className="px-5 py-3.5">Tipo</th>
                    <th className="px-5 py-3.5">Qtd.</th>
                    <th className="px-5 py-3.5">Motivo / Lote</th>
                    <th className="px-5 py-3.5 text-right">Saldo (De ➔ Para)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-trigon-800/80">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-trigon-500">
                        Nenhuma movimentação registrada no estoque de cartas.
                      </td>
                    </tr>
                  ) : (
                    paginatedMovements.map((mov) => {
                    const isEntry = mov.newStock >= mov.previousStock;
                    const v = mov.variant;
                    return (
                      <tr
                        key={mov.id}
                        className="hover:bg-trigon-850/50 transition-colors"
                      >
                        <td className="px-5 py-3 text-xs text-trigon-400 whitespace-nowrap">
                          {formatDateTime(mov.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="space-y-1">
                            <span className="font-semibold text-white block">
                              {v?.card?.name || 'Carta TCG'}{' '}
                              <span className="text-xs text-trigon-400 font-normal">
                                ({v?.card?.setName})
                              </span>
                            </span>
                            {v && (
                              <div className="flex flex-wrap items-center gap-1">
                                <CardConditionBadge
                                  value={v.condition}
                                  size="sm"
                                  useShortLabel
                                />
                                <CardLanguageBadge
                                  value={v.language}
                                  size="sm"
                                  useShortLabel
                                />
                                <CardFinishBadge
                                  value={v.finish}
                                  size="sm"
                                  useShortLabel
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {mov.type === 'ENTRADA' ? (
                            <Badge variant="success" size="sm">
                              <span className="inline-flex items-center gap-1">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                Entrada
                              </span>
                            </Badge>
                          ) : mov.type === 'SAIDA' ? (
                            <Badge variant="danger" size="sm">
                              <span className="inline-flex items-center gap-1">
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                                Saída
                              </span>
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm">
                              Ajuste
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              isEntry ? 'text-emerald-400' : 'text-red-400'
                            }
                          >
                            {isEntry ? `+${mov.quantity}` : `-${mov.quantity}`} un.
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-trigon-300">
                          <p className="text-white font-medium">{mov.reason}</p>
                          <div className="flex items-center gap-2 text-[11px] text-trigon-500">
                            {mov.unitCost !== null && (
                              <span>
                                Custo Lote:{' '}
                                <strong className="text-trigon-300 font-mono">
                                  {formatCurrency(mov.unitCost)}
                                </strong>
                              </span>
                            )}
                            {mov.actor && <span>• Resp: {mov.actor}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs whitespace-nowrap">
                          <span className="text-trigon-500">{mov.previousStock}</span>
                          <span className="text-trigon-600 mx-1.5">➔</span>
                          <span className="text-white font-bold">
                            {mov.newStock} un.
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação do Histórico de Movimentações */}
          <Pagination
            currentPage={historyPage}
            totalPages={totalHistoryPages}
            totalItems={totalHistoryItems}
            itemsPerPage={historyPerPage}
            onPageChange={setHistoryPage}
            onItemsPerPageChange={(limit) => {
              setHistoryPerPage(limit);
              setHistoryPage(1);
            }}
            itemsPerPageOptions={[10, 25, 50]}
            itemLabel="registro(s)"
          />
        </div>
      )}
    </div>

      {/* Modal: Adicionar Cartas via Busca TCGdex sem sair do Estoque */}
      <Modal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        title="Adicionar Cartas ao Estoque"
        description="Pesquise no catálogo TCGdex por nome ou número (ex: 20/156) e selecione a carta."
        maxWidth="5xl"
      >
        <TcgdexCatalogSearch
          registeredStockMap={registeredStockMap}
          compact
          pageSize={10}
          onSelectCardForDetails={handleOpenCardDetails}
          onQuickAddToStock={handleQuickAddFromCatalogModal}
          onOpenManualRegister={() => {
            setIsCatalogModalOpen(false);
            setIsManualRegisterModalOpen(true);
          }}
        />
      </Modal>

      {/* Modal: Cadastro Manual de Carta TCG */}
      <CardManualRegisterModal
        isOpen={isManualRegisterModalOpen}
        onClose={() => setIsManualRegisterModalOpen(false)}
        onSuccess={() => {
          loadStockData();
        }}
      />

      {/* Modal: Detalhes da Carta */}
      <CardDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        cardId={detailsCardId}
        registeredStock={
          detailsCardId ? registeredStockMap[detailsCardId] || null : null
        }
        onAddToStock={handleAddFromDetailsModal}
        onStockUpdated={loadStockData}
      />

      {/* Modal: Cadastro de Variante no Estoque */}
      <CardVariantFormModal
        isOpen={isVariantFormOpen}
        onClose={() => setIsVariantFormOpen(false)}
        cardDetail={cardForVariantForm}
        customLigaUrl={customLigaUrlForForm}
        onSuccess={loadStockData}
      />

      {/* Modal: Movimentação de Estoque da Variante */}
      <CardStockMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        variant={movementTargetVariant}
        defaultType={movementDefaultType}
        onMovementRecorded={loadStockData}
      />

      {/* Modal: Edição de Dados da Carta, Preços, Vínculo Comercial e Lotes */}
      <CardVariantEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditTargetVariant(null);
        }}
        variant={editTargetVariant}
        categories={categories}
        collections={collections}
        onSaved={loadStockData}
        onDeleted={loadStockData}
      />

      {/* Modal: Vínculo com o Catálogo (acionado pelo ícone de vínculo na linha) */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Vincular Carta ao Catálogo"
        description="Vincule opcionalmente esta carta a uma Linha de Produtos ou Coleção do Catálogo TRIGON."
        maxWidth="md"
      >
        {linkTargetVariant && (
          <form onSubmit={handleSaveCommercialLink} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-trigon-950 border border-trigon-800 flex items-center gap-3">
              <CardThumbnail
                image={linkTargetVariant.card?.imageUrl}
                alt={linkTargetVariant.card?.name || 'Carta'}
                quality="low"
                size="sm"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-bold text-white text-sm truncate">
                  {linkTargetVariant.card?.name || 'Carta TCG'}{' '}
                  <span className="font-mono text-xs text-trigon-400">
                    (
                    {formatCardNumber(
                      linkTargetVariant.card?.localId,
                      linkTargetVariant.card?.totalCards
                    )}
                    )
                  </span>
                </p>
                <p className="text-xs text-trigon-400 truncate">
                  Coleção: <strong className="text-white">{linkTargetVariant.card?.setName}</strong>
                </p>
                <div className="flex items-center gap-1.5">
                  <CardConditionBadge value={linkTargetVariant.condition} size="sm" />
                  <CardLanguageBadge value={linkTargetVariant.language} size="sm" />
                  <CardFinishBadge value={linkTargetVariant.finish} size="sm" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
                Vínculo com o Catálogo TRIGON
              </label>
              <select
                value={selectedLinkValue}
                onChange={(e) => setSelectedLinkValue(e.target.value)}
                aria-label="Selecionar vínculo com o catálogo TRIGON"
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              >
                <option value="">Controle Interno (Sem vínculo com o catálogo)</option>
                {categories.length > 0 && (
                  <optgroup label="Linhas de Produtos">
                    {categories.map((cat) => (
                      <option key={cat.id} value={`cat:${cat.id}`}>
                        Linha: {cat.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {collections.length > 0 && (
                  <optgroup label="Coleções do Catálogo">
                    {collections.map((col) => (
                      <option key={col.id} value={`col:${col.id}`}>
                        Coleção: {col.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-trigon-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsLinkModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={savingLink}>
                Salvar Vínculo
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal de Adicionar ao Leilão / Pré-Leilão */}
      <AddCardToAuctionModal
        isOpen={isAddToAuctionModalOpen}
        onClose={() => {
          setIsAddToAuctionModalOpen(false);
          setAuctionTargetVariant(null);
        }}
        variant={auctionTargetVariant}
        onSuccess={loadStockData}
      />

      {/* Modal de Confirmação de Exclusão de Variante */}
      {variantToDelete && (
        <Modal
          isOpen={Boolean(variantToDelete)}
          onClose={() => !isDeletingVariant && setVariantToDelete(null)}
          title="Excluir Variante do Estoque"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-crimson-950/40 border border-crimson-500/40 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-crimson-400 shrink-0 mt-0.5" />
              <div className="text-xs text-trigon-300 space-y-1">
                <p className="font-bold text-white">Esta ação é irreversível!</p>
                <p>
                  A variante será removida permanentemente do seu estoque, incluindo seus registros de lotes de aquisição e movimentações vinculadas.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-trigon-900/80 border border-trigon-800 flex items-center gap-3">
              <CardThumbnail
                image={variantToDelete.card?.imageUrl}
                alt={variantToDelete.card?.name || 'Carta'}
                quality="low"
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-white text-sm truncate">
                  {variantToDelete.card?.name}
                </h4>
                <p className="text-xs text-trigon-400 truncate">
                  {variantToDelete.card?.setName} • {formatCardNumber(variantToDelete.card?.localId, variantToDelete.card?.totalCards)}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-trigon-950 border border-trigon-750 text-trigon-300 font-bold font-mono">
                    {variantToDelete.condition}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-trigon-950 border border-trigon-750 text-trigon-300 font-bold">
                    {variantToDelete.language}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-trigon-950 border border-trigon-750 text-amber-300 font-bold">
                    {variantToDelete.finish}
                  </span>
                  <span className="font-bold text-crimson-400 font-mono ml-auto">
                    {variantToDelete.quantity} un. em estoque
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setVariantToDelete(null)}
                disabled={isDeletingVariant}
              >
                Cancelar
              </Button>
              <button
                type="button"
                onClick={handleConfirmDeleteVariant}
                disabled={isDeletingVariant}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-700 text-white text-xs font-bold transition-all shadow-glow-crimson disabled:opacity-50"
              >
                {isDeletingVariant ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Menu Flutuante Global de Ações (Posicionamento Fixo, imune a overflow da tabela) */}
      {actionMenuState && (() => {
        const variant = actionMenuState.variant;
        const card = variant.card;
        const ligaUrl = buildLigaPokemonUrl({
          name: card?.name || '',
          localId: card?.localId,
          totalCards: card?.totalCards,
          setId: card?.setCode,
          setName: card?.setName,
          customUrl: card?.ligaPokemonUrl,
        });
        const linkedCategoryName = getCategoryName(variant.categoryId);
        const linkedCollectionName = getCollectionName(variant.collectionId);
        const hasCommercialLink = Boolean(linkedCategoryName || linkedCollectionName);

        return (
          <div
            data-stock-action-menu
            className="fixed w-56 rounded-xl bg-trigon-950 border border-trigon-750 shadow-2xl py-1 z-[9999] divide-y divide-trigon-850 animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: `${actionMenuState.top}px`,
              right: `${actionMenuState.right}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-1">
              {/* 1. Adicionar ao Leilão */}
              <button
                type="button"
                disabled={variant.quantity <= 0}
                onClick={() => {
                  setActionMenuState(null);
                  handleOpenAuctionModal(variant);
                }}
                className={`w-full px-3.5 py-2 text-left text-xs font-medium flex items-center gap-2.5 transition-colors ${
                  variant.quantity <= 0
                    ? 'text-trigon-600 cursor-not-allowed opacity-50'
                    : 'text-amber-300 hover:bg-amber-950/40 hover:text-amber-200'
                }`}
              >
                <Gavel className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div className="flex-1 truncate">
                  <span>Adicionar ao Leilão</span>
                  {variant.quantity <= 0 && (
                    <span className="block text-[10px] text-trigon-500 font-normal">
                      (Sem unidades em estoque)
                    </span>
                  )}
                </div>
              </button>

              {/* 2. Movimentar Quantidade */}
              <button
                type="button"
                onClick={() => {
                  setActionMenuState(null);
                  handleOpenMovementModal(variant, 'ENTRADA');
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-trigon-200 hover:text-white hover:bg-trigon-850 flex items-center gap-2.5 transition-colors"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-crimson-400 shrink-0" />
                <span>Movimentar Estoque</span>
              </button>

              {/* 3. Editar Dados da Carta (Foil, Idioma, Condição, Preços) */}
              <button
                type="button"
                onClick={() => {
                  setActionMenuState(null);
                  handleOpenEditModal(variant);
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-emerald-300 hover:text-emerald-200 hover:bg-emerald-950/30 flex items-center gap-2.5 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Editar Carta & Preços</span>
              </button>

              {/* 4. Vincular ao Catálogo */}
              <button
                type="button"
                onClick={() => {
                  setActionMenuState(null);
                  handleOpenLinkModal(variant);
                }}
                className={`w-full px-3.5 py-2 text-left text-xs font-medium flex items-center gap-2.5 transition-colors ${
                  hasCommercialLink
                    ? 'text-amber-300 hover:bg-amber-950/40'
                    : 'text-trigon-200 hover:text-white hover:bg-trigon-850'
                }`}
              >
                <Link2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div className="flex-1 truncate">
                  <span>Vincular ao Catálogo</span>
                  {hasCommercialLink && (
                    <span className="block text-[10px] text-amber-400/80 truncate">
                      {linkedCategoryName || linkedCollectionName}
                    </span>
                  )}
                </div>
              </button>

              {/* 5. Consultar na Liga Pokémon */}
              <a
                href={ligaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setActionMenuState(null)}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-trigon-300 hover:text-white hover:bg-trigon-850 flex items-center gap-2.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Ver na Liga Pokémon</span>
              </a>
            </div>

            {/* 6. Excluir Variante do Estoque */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setActionMenuState(null);
                  handleOpenDeleteModal(variant);
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 flex items-center gap-2.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>Excluir do Estoque</span>
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
