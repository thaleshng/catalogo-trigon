import React, { useState, useEffect, useMemo } from 'react';
import {
  TcgCardVariant,
  TcgAuction,
  Customer,
  AuctionPaymentStatus,
  AuctionShippingStatus,
} from '../../../../types';
import { formatCurrency } from '../../../../utils/formatters';
import { Modal } from '../../../../components/common/Modal';
import { Button } from '../../../../components/common/Button';
import { useToast } from '../../../../components/common/Toast';
import { auctionService } from '../../../../services/auctionService';
import { cardStockService } from '../../../../services/cardStockService';
import { customerService } from '../../../../services/customerService';
import { storageUploadService } from '../../../../services/storageUploadService';
import { optimizeImageFile, optimizeImage } from '../../../../utils/imageUpload';
import { cleanSetName, compareCardNumbers } from '../../../../config/tcgSetTranslations';
import { matchesCardQuery } from '../../../../services/tcgdexService';
import { CustomerSearchSelect } from './CustomerSearchSelect';
import {
  CardConditionBadge,
  CardLanguageBadge,
  CardFinishBadge,
} from '../CardAttributeBadges';
import { CardThumbnail } from '../CardThumbnail';
import {
  Gavel,
  Plus,
  X,
  Search,
  Layers,
  Sparkles,
  History,
  CheckCircle2,
  XCircle,
  Camera,
  UploadCloud,
  Trash2,
} from 'lucide-react';

interface AddCardToAuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: TcgCardVariant | null;
  initialVariants?: TcgCardVariant[];
  defaultAuctionId?: string;
  onSuccess?: () => void;
}

export const AddCardToAuctionModal: React.FC<AddCardToAuctionModalProps> = ({
  isOpen,
  onClose,
  variant,
  initialVariants,
  defaultAuctionId,
  onSuccess,
}) => {
  const { success, error } = useToast();

  const [auctions, setAuctions] = useState<TcgAuction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedAuctionId, setSelectedAuctionId] = useState(defaultAuctionId || '');
  const [selectedVariants, setSelectedVariants] = useState<TcgCardVariant[]>([]);
  const [availableStock, setAvailableStock] = useState<TcgCardVariant[]>([]);

  // Pesquisa para adicionar mais cartas ao lote
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardSearchTerm, setCardSearchTerm] = useState('');

  // Campos do lote
  const [customTitle, setCustomTitle] = useState('');
  const [initialPriceStr, setInitialPriceStr] = useState('10');
  const [bidStepStr, setBidStepStr] = useState('2');
  const [isFreebie, setIsFreebie] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fileInputPcRef = React.useRef<HTMLInputElement>(null);
  const cameraMobileRef = React.useRef<HTMLInputElement>(null);

  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const mobileRegex = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return mobileRegex.test(userAgent) || (window.innerWidth <= 768 && hasTouch);
  }, []);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    try {
      setUploadingPhoto(true);
      // Comprime a foto no navegador antes do envio (reduz de ~6MB para ~90KB)
      const compressedFile = await optimizeImageFile(rawFile, 1200, 0.82);

      try {
        const publicUrl = await storageUploadService.uploadImage(compressedFile, 'products');
        setCustomPhotoUrl(publicUrl);
        success('Foto otimizada e anexada com sucesso!');
      } catch {
        const base64 = await optimizeImage(rawFile, 1200);
        setCustomPhotoUrl(base64);
        success('Foto otimizada e anexada localmente!');
      }
    } catch (err: any) {
      error('Erro ao processar imagem.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  // Campos específicos para Leilões Passados / Retroativos (FINALIZADO)
  const [pastOutcome, setPastOutcome] = useState<'ARREMATADO' | 'NAO_ARREMATADO'>('ARREMATADO');
  const [pastWinnerCustomerId, setPastWinnerCustomerId] = useState('');
  const [pastFinalPriceStr, setPastFinalPriceStr] = useState('');
  const [pastPaymentStatus, setPastPaymentStatus] = useState<AuctionPaymentStatus>('PAGO');
  const [pastShippingStatus, setPastShippingStatus] = useState<AuctionShippingStatus>('RECEBIDO');

  // Inicializa variantes e leilões quando abre
  useEffect(() => {
    if (!isOpen) return;

    // Carrega TODOS os leilões (ativos, pré-leilões e passados/finalizados)
    auctionService.getAuctions().then((list: TcgAuction[]) => {
      setAuctions(list);
      if (defaultAuctionId) {
        setSelectedAuctionId(defaultAuctionId);
      } else if (list.length > 0) {
        // Se houver algum leilão ativo/pré-leilão, prefere ele; senão o mais recente
        const active = list.find((a) => a.status !== 'FINALIZADO');
        setSelectedAuctionId(active ? active.id : list[0].id);
      }
    });

    // Carrega clientes para vincular arremates de leilões passados
    customerService.getCustomers().then((custs) => {
      setCustomers(custs);
      if (custs.length > 0) {
        setPastWinnerCustomerId(custs[0].id);
      }
    });

    // Carrega estoque para possibilitar juntar mais cartas no lote
    cardStockService.getVariants().then((vars) => {
      setAvailableStock(vars.filter((v) => v.quantity > 0));
    });

    let initialList: TcgCardVariant[] = [];
    if (initialVariants && initialVariants.length > 0) {
      initialList = [...initialVariants].sort((a, b) =>
        compareCardNumbers(a.card?.localId, b.card?.localId)
      );
    } else if (variant) {
      initialList = [variant];
    }

    setSelectedVariants(initialList);
    setIsAddingCard(false);
    setCardSearchTerm('');
    setCustomPhotoUrl('');
    setNotes('');
    setIsFreebie(false);
    setPastOutcome('ARREMATADO');
    setPastPaymentStatus('PAGO');
    setPastShippingStatus('RECEBIDO');

    if (initialList.length > 0) {
      // Sugere título
      const autoTitle = initialList
        .map((v) => {
          const num = v.card?.localId
            ? ` (${v.card.localId}${v.card.totalCards ? `/${v.card.totalCards}` : ''})`
            : '';
          return `${v.card?.name || 'Carta TCG'}${num}`;
        })
        .join(' + ');
      setCustomTitle(autoTitle);

      // Sugere preço inicial (soma dos preços de venda)
      const sumSale = initialList.reduce((acc, v) => {
        const p = v.salePrice && v.salePrice > 0 ? v.salePrice : v.referenceValue || 0;
        return acc + Number(p);
      }, 0);

      const defaultPrice = sumSale > 0 ? String(sumSale) : '10';
      setInitialPriceStr(defaultPrice);
      setPastFinalPriceStr(defaultPrice);
      setBidStepStr('2');
    }
  }, [isOpen, variant, initialVariants, defaultAuctionId]);

  // Recalcula título e preço quando a lista de variantes muda
  const handleAddVariantToBundle = (newVariant: TcgCardVariant) => {
    const updated = [...selectedVariants, newVariant].sort((a, b) =>
      compareCardNumbers(a.card?.localId, b.card?.localId)
    );
    setSelectedVariants(updated);
    setIsAddingCard(false);
    setCardSearchTerm('');

    // Atualiza título automaticamente
    const autoTitle = updated
      .map((v) => {
        const num = v.card?.localId
          ? ` (${v.card.localId}${v.card.totalCards ? `/${v.card.totalCards}` : ''})`
          : '';
        return `${v.card?.name || 'Carta TCG'}${num}`;
      })
      .join(' + ');
    setCustomTitle(autoTitle);

    // Soma dos preços
    const sumSale = updated.reduce((acc, v) => {
      const p = v.salePrice && v.salePrice > 0 ? v.salePrice : v.referenceValue || 0;
      return acc + Number(p);
    }, 0);
    if (sumSale > 0) {
      setInitialPriceStr(String(sumSale));
      setPastFinalPriceStr(String(sumSale));
    }
  };

  const handleRemoveVariantFromBundle = (variantId: string) => {
    if (selectedVariants.length <= 1) return;
    const updated = selectedVariants.filter((v) => v.id !== variantId);
    setSelectedVariants(updated);

    const autoTitle = updated
      .map((v) => {
        const num = v.card?.localId
          ? ` (${v.card.localId}${v.card.totalCards ? `/${v.card.totalCards}` : ''})`
          : '';
        return `${v.card?.name || 'Carta TCG'}${num}`;
      })
      .join(' + ');
    setCustomTitle(autoTitle);
  };

  const initialPriceNum = Math.max(0, parseFloat(initialPriceStr) || 0);
  const bidStepNum = Math.max(0.5, Math.min(100, parseFloat(bidStepStr) || 1));
  const pastFinalPriceNum = Math.max(0, parseFloat(pastFinalPriceStr) || 0);

  const previewOptions = isFreebie
    ? [0, 0, 0, 0, 0]
    : auctionService.calculateBidOptions(initialPriceNum, bidStepNum);

  const totalCostPrice = useMemo(() => {
    return selectedVariants.reduce(
      (acc, v) => acc + Number(v.acquisitionCost || 0),
      0
    );
  }, [selectedVariants]);

  // Identifica o leilão selecionado e se ele é passado/finalizado
  const selectedAuction = useMemo(() => {
    return auctions.find((a) => a.id === selectedAuctionId);
  }, [auctions, selectedAuctionId]);

  const isTargetFinalizado = selectedAuction?.status === 'FINALIZADO';

  const activeAuctions = useMemo(() => {
    return auctions.filter((a) => a.status !== 'FINALIZADO');
  }, [auctions]);

  const pastAuctions = useMemo(() => {
    return auctions.filter((a) => a.status === 'FINALIZADO');
  }, [auctions]);

  // Filtra estoque disponível excluindo as já selecionadas
  const filteredStockCandidates = useMemo(() => {
    const selectedIds = new Set(selectedVariants.map((v) => v.id));
    return availableStock.filter((v) => {
      if (selectedIds.has(v.id)) return false;
      return matchesCardQuery(cardSearchTerm, v.card);
    });
  }, [availableStock, selectedVariants, cardSearchTerm]);

  if (!isOpen || selectedVariants.length === 0) return null;

  const isCombo = selectedVariants.length > 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuctionId) {
      error('Selecione em qual leilão deseja adicionar este lote.');
      return;
    }

    if (isTargetFinalizado && pastOutcome === 'ARREMATADO' && !pastWinnerCustomerId) {
      error('Selecione qual cliente arrematou o lote no leilão passado.');
      return;
    }

    try {
      setSubmitting(true);
      await auctionService.addCardsToAuction({
        auctionId: selectedAuctionId,
        variantIds: selectedVariants.map((v) => v.id),
        initialPrice: isFreebie ? 0 : initialPriceNum,
        bidStep: bidStepNum,
        isFreebie,
        customTitle: customTitle.trim() || undefined,
        customPhotoUrl: customPhotoUrl.trim() || null,
        notes: notes.trim() || null,
        // Parâmetros retroativos
        pastOutcome: isTargetFinalizado ? pastOutcome : undefined,
        pastWinningCustomerId: isTargetFinalizado && pastOutcome === 'ARREMATADO' ? pastWinnerCustomerId : null,
        pastFinalPrice: isTargetFinalizado && pastOutcome === 'ARREMATADO' ? pastFinalPriceNum : null,
        pastPaymentStatus: isTargetFinalizado && pastOutcome === 'ARREMATADO' ? pastPaymentStatus : undefined,
        pastShippingStatus: isTargetFinalizado && pastOutcome === 'ARREMATADO' ? pastShippingStatus : undefined,
      });

      const chosenCode = selectedAuction?.code || '';
      let msg = '';
      if (isTargetFinalizado) {
        msg = pastOutcome === 'ARREMATADO'
          ? `Lote arrematado registrado no Leilão Passado #${chosenCode}! ${selectedVariants.length} un. baixada(s) do estoque.`
          : `Lote não arrematado registrado no Leilão Passado #${chosenCode}! Estoque mantido.`;
      } else {
        msg = isCombo
          ? `Lote Combo (${selectedVariants.length} cartas) adicionado ao Leilão #${chosenCode}! ${selectedVariants.length} unidade(s) reservada(s) no estoque.`
          : `Carta adicionada ao Leilão #${chosenCode}! 1 unidade reservada no estoque.`;
      }

      success(msg);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      error(err.message || 'Erro ao adicionar lote ao leilão.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isTargetFinalizado
          ? `Registrar Lote no Leilão Passado #${selectedAuction?.code || ''}`
          : isCombo
            ? `Adicionar Lote Dupla / Combo (${selectedVariants.length} Cartas)`
            : 'Adicionar Carta ao Leilão'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Aviso se for Leilão Passado (Retroativo) */}
        {isTargetFinalizado && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-300 flex items-start gap-2.5">
            <History className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Registro em Leilão Passado (Finalizado):</strong>
              Este leilão já ocorreu no passado. O lote não entrará como &quot;Em Leilão&quot;, mas sim diretamente com o resultado do evento (Arrematado com cliente e valor, ou Não Arrematado).
            </div>
          </div>
        )}

        {/* Identificação das Cartas Selecionadas no Lote */}
        <div className="p-3.5 rounded-2xl bg-trigon-950 border border-trigon-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold tracking-wider text-trigon-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-crimson-400" />
              <span>
                {isCombo
                  ? `Cartas Inclusas na Dupla / Combo (${selectedVariants.length})`
                  : 'Carta Inclusa no Lote (1)'}
              </span>
            </span>

            {isCombo && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                ⚡ DUPLA / COMBO
              </span>
            )}
          </div>

          {/* Lista de Cartas do Lote */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {selectedVariants.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-trigon-900 border border-trigon-800"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <CardThumbnail
                    image={v.card?.imageUrl}
                    alt={v.card?.name || 'Carta'}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white text-xs truncate">
                        {v.card?.name}
                      </span>
                      <span className="font-mono text-[10px] text-trigon-400">
                        #{v.card?.localId}{v.card?.totalCards ? `/${v.card.totalCards}` : ''}
                      </span>
                    </div>
                    <span className="text-[11px] text-trigon-400 block truncate">
                      {cleanSetName(v.card?.setName)}
                    </span>
                    <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                      <CardConditionBadge value={v.condition} size="sm" useShortLabel />
                      <CardLanguageBadge value={v.language} size="sm" />
                      <CardFinishBadge value={v.finish} size="sm" />
                      <span className="text-[10px] text-trigon-500 ml-1">
                        Custo: {formatCurrency(v.acquisitionCost || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedVariants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveVariantFromBundle(v.id)}
                    className="p-1 rounded-lg text-trigon-500 hover:text-red-400 hover:bg-trigon-800 transition-colors shrink-0"
                    title="Remover esta carta do lote"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Botão para Adicionar mais cartas (Dupla / Trio / Combo) */}
          {!isAddingCard ? (
            <button
              type="button"
              onClick={() => setIsAddingCard(true)}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-trigon-750 hover:border-amber-500/50 hover:bg-amber-950/20 text-xs font-semibold text-amber-400 flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar outra carta ao lote (formar Dupla / Combo)</span>
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-trigon-900 border border-amber-500/40 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Escolha uma carta do estoque para juntar neste lote:</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCard(false);
                    setCardSearchTerm('');
                  }}
                  className="text-trigon-400 hover:text-white text-xs"
                >
                  Cancelar
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-trigon-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cardSearchTerm}
                  onChange={(e) => setCardSearchTerm(e.target.value)}
                  placeholder="Pesquisar por nome, número (ex: 020/196) ou coleção..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 pt-1 pr-1">
                {filteredStockCandidates.length === 0 ? (
                  <div className="text-center py-3 text-xs text-trigon-500">
                    Nenhuma outra carta disponível com saldo encontrada.
                  </div>
                ) : (
                  filteredStockCandidates.slice(0, 15).map((cand) => (
                    <div
                      key={cand.id}
                      onClick={() => handleAddVariantToBundle(cand)}
                      className="flex items-center justify-between p-2 rounded-lg bg-trigon-950/60 hover:bg-amber-950/40 border border-trigon-800/80 hover:border-amber-500/40 cursor-pointer transition-all text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CardThumbnail image={cand.card?.imageUrl} alt={cand.card?.name || 'Carta'} size="sm" />
                        <div className="truncate">
                          <span className="font-bold text-white block truncate">
                            {cand.card?.name} #{cand.card?.localId}
                          </span>
                          <span className="text-[10px] text-trigon-400 block truncate">
                            {cleanSetName(cand.card?.setName)} • {cand.condition} • {cand.language}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-emerald-400 font-mono font-bold block">
                          {formatCurrency(cand.salePrice || cand.referenceValue || 0)}
                        </span>
                        <span className="text-[10px] text-amber-300">
                          {cand.quantity} un.
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Título do Lote */}
        <div>
          <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
            Título do Lote *
          </label>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Ex: Dottler (019/196) + Orbeetle (020/196)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-semibold"
            required
          />
        </div>

        {/* Seleção do Leilão de Destino */}
        <div>
          <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
            Leilão de Destino *
          </label>
          {auctions.length === 0 ? (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-300">
              Nenhum leilão cadastrado no sistema ainda. Cadastre um leilão ou pré-leilão no menu <strong>Leilões</strong> primeiro!
            </div>
          ) : (
            <select
              value={selectedAuctionId}
              onChange={(e) => setSelectedAuctionId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-medium"
              required
            >
              {activeAuctions.length > 0 && (
                <optgroup label="Leilões Ativos / Pré-Leilões">
                  {activeAuctions.map((auc) => (
                    <option key={auc.id} value={auc.id}>
                      Leilão #{auc.code} ({auc.status === 'EM_ANDAMENTO' ? '● Em Andamento' : 'Pré-Leilão'}) — {auc.title}
                    </option>
                  ))}
                </optgroup>
              )}
              {pastAuctions.length > 0 && (
                <optgroup label="Leilões Passados / Finalizados (Histórico)">
                  {pastAuctions.map((auc) => (
                    <option key={auc.id} value={auc.id}>
                      Leilão #{auc.code} (FINALIZADO) — {auc.title}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SE FOR LEILÃO FINALIZADO (PASSADO): CAMPOS DE RESULTADO REAL DO EVENTO */}
        {/* ========================================================================= */}
        {isTargetFinalizado ? (
          <div className="p-4 rounded-2xl bg-trigon-950 border-2 border-amber-500/40 space-y-4">
            {/* Título da Seção Histórica */}
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Resultado Real no Leilão #{selectedAuction?.code}
              </span>
            </div>

            {/* Seletor de Resultado em linha inteira dedicada (com espaçamento adequado) */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-trigon-900 border border-trigon-800">
              <button
                type="button"
                onClick={() => setPastOutcome('ARREMATADO')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  pastOutcome === 'ARREMATADO'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-trigon-400 hover:text-white hover:bg-trigon-800/40'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Arrematado</span>
              </button>
              <button
                type="button"
                onClick={() => setPastOutcome('NAO_ARREMATADO')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  pastOutcome === 'NAO_ARREMATADO'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-trigon-400 hover:text-white hover:bg-trigon-800/40'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>Não Saiu</span>
              </button>
            </div>

            {pastOutcome === 'ARREMATADO' ? (
              <div className="space-y-3 pt-1">
                {/* Linha 1: Cliente e Valor Final (Alinhamento Perfeito) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase text-trigon-300 truncate h-4 leading-4">
                      Cliente que Arrematou *
                    </label>
                    <CustomerSearchSelect
                      customers={customers}
                      selectedCustomerId={pastWinnerCustomerId}
                      onSelectCustomer={(id) => setPastWinnerCustomerId(id)}
                      placeholder="Pesquise o cliente por nome..."
                      accentColor="emerald"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase text-trigon-300 truncate h-4 leading-4">
                      Valor Final do Arremate (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={isFreebie}
                      value={pastFinalPriceStr}
                      onChange={(e) => setPastFinalPriceStr(e.target.value)}
                      placeholder="Ex: 25.00"
                      className="w-full h-10 px-3 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-emerald-400 text-sm font-mono focus:outline-none focus:border-emerald-500 font-bold"
                      required
                    />
                  </div>
                </div>

                {/* Linha 2: Status do Pagamento e Situação de Envio (Alinhamento Perfeito) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase text-trigon-300 truncate h-4 leading-4">
                      Status do Pagamento
                    </label>
                    <select
                      value={pastPaymentStatus}
                      onChange={(e) => setPastPaymentStatus(e.target.value as AuctionPaymentStatus)}
                      className="w-full h-10 px-3 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="PAGO">Pago (Quitado)</option>
                      <option value="PENDENTE">Pendente</option>
                      <option value="VENCIDO">Vencido</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase text-trigon-300 truncate h-4 leading-4">
                      Situação de Envio
                    </label>
                    <select
                      value={pastShippingStatus}
                      onChange={(e) => setPastShippingStatus(e.target.value as AuctionShippingStatus)}
                      className="w-full h-10 px-3 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="RECEBIDO">Recebido pelo Cliente</option>
                      <option value="ENVIADO">Enviado</option>
                      <option value="SOLICITADO">Solicitado</option>
                      <option value="NAO_SOLICITADO">Não Solicitado (Armazenado)</option>
                    </select>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-300">
                  ✓ O faturamento deste lote será computado no histórico do Leilão #{selectedAuction?.code} e{' '}
                  <strong>{selectedVariants.length} unidade(s)</strong> serão baixadas do estoque como arrematadas.
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-trigon-900/80 border border-trigon-800 text-xs text-trigon-300">
                O lote foi ofertado no Leilão #{selectedAuction?.code} mas não teve lances. O saldo atual do estoque{' '}
                <strong>não será alterado</strong>.
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* SE FOR LEILÃO ATIVO OU PRÉ-LEILÃO: FLUXO DE VALOR INICIAL E ENQUETE      */
          /* ========================================================================= */
          <>
            {/* Valores: Inicial e Incremento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase text-trigon-300 truncate h-4 leading-4">
                  Valor Inicial (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={isFreebie}
                  value={initialPriceStr}
                  onChange={(e) => setInitialPriceStr(e.target.value)}
                  placeholder="Ex: 10.00"
                  className="w-full h-10 px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono focus:outline-none focus:border-crimson-500 font-bold"
                  required
                />
                <span className="text-[10px] text-trigon-500 mt-0.5 block">
                  {isCombo
                    ? 'Soma dos valores sugeridos das cartas'
                    : 'Sugerido do preço do estoque'}
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase text-trigon-300 truncate h-4 leading-4">
                  Incremento por Lance (R$) *
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0.50"
                  max="100"
                  disabled={isFreebie}
                  value={bidStepStr}
                  onChange={(e) => setBidStepStr(e.target.value)}
                  placeholder="Ex: 2.00"
                  className="w-full h-10 px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono focus:outline-none focus:border-crimson-500 font-bold"
                  required
                />
                <span className="text-[10px] text-trigon-500 mt-0.5 block">
                  Limite máx: R$ 100,00
                </span>
              </div>
            </div>

            {/* Preview das 5 Opções Geradas */}
            <div className="p-3.5 rounded-xl bg-trigon-950 border border-trigon-800 space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-trigon-400 block">
                Prévia das 5 Opções da Enquete no WhatsApp:
              </span>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {previewOptions.map((opt: number, i: number) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg font-mono text-xs font-bold border ${
                      i === 4
                        ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                        : 'bg-trigon-900 border-trigon-750 text-white'
                    }`}
                  >
                    <span>{formatCurrency(opt)}</span>
                    {i === 4 && <span className="block text-[9px] uppercase text-amber-400">Arremate</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Aviso de Reserva de Estoque para Leilões Ativos */}
            <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-300">
              ℹ️ <strong>Reserva no Estoque:</strong> Ao adicionar este lote,{' '}
              <strong>{selectedVariants.length} unidade(s)</strong> (1 de cada carta) serão subtraídas temporariamente do estoque. Se ao final do leilão o lote não for arrematado, todas voltarão automaticamente ao estoque!
            </div>
          </>
        )}

        {/* Custo Total Consolidado */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-trigon-950 border border-trigon-800 text-xs">
          <span className="text-trigon-400">
            Custo total das cartas no lote:
          </span>
          <span className="font-mono font-bold text-amber-300">
            {formatCurrency(totalCostPrice)}
          </span>
        </div>

        {/* Checkbox de Brinde */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="isFreebieVariant"
            checked={isFreebie}
            onChange={(e) => setIsFreebie(e.target.checked)}
            className="rounded border-trigon-700 bg-trigon-900 text-crimson-600 focus:ring-crimson-500"
          />
          <label htmlFor="isFreebieVariant" className="text-xs text-trigon-300 cursor-pointer">
            🎁 Considerar como <strong>Brinde</strong> no leilão (Valor de venda final será R$ 0,00)
          </label>
        </div>

        {/* Foto Real das Cartas (Upload do PC vs Câmera do Celular) */}
        <div className="p-3.5 rounded-2xl bg-trigon-950 border border-trigon-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase text-trigon-300">
              Foto Real das Cartas (Opcional)
            </label>
            {customPhotoUrl && (
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Foto anexada
              </span>
            )}
          </div>

          {/* Inputs ocultos acionados pelos botões */}
          <input
            ref={fileInputPcRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFilePicked}
          />
          <input
            ref={cameraMobileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFilePicked}
          />

          {/* Prévia da Foto Real */}
          {customPhotoUrl ? (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-trigon-900 border border-emerald-500/40">
              <div className="w-14 h-16 rounded-lg overflow-hidden bg-black flex items-center justify-center border border-trigon-750 shrink-0">
                <img
                  src={customPhotoUrl}
                  alt="Prévia Foto Real"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">Foto Real Anexada</p>
                <p className="text-[10px] text-emerald-400 font-mono">
                  {customPhotoUrl.startsWith('data:') ? 'Imagem salva localmente' : 'Imagem hospedada online'}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputPcRef.current?.click()}
                    className="text-[11px] text-trigon-300 hover:text-white underline font-medium"
                  >
                    Trocar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomPhotoUrl('')}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
                  >
                    <Trash2 className="w-3 h-3" /> Remover
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Opção 1: Upload do PC / Arquivo */}
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputPcRef.current?.click()}
                className="py-2.5 px-3 rounded-xl border border-trigon-750 bg-trigon-900 hover:border-trigon-600 hover:bg-trigon-850 text-white flex items-center justify-center gap-2 text-xs font-medium transition-all group shadow-sm"
              >
                <UploadCloud className="w-4 h-4 text-trigon-400 group-hover:text-white transition-colors" />
                <span>Upload do PC</span>
              </button>

              {/* Opção 2: Câmera do Celular */}
              {isMobileDevice ? (
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => cameraMobileRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl border border-crimson-500/40 bg-crimson-950/40 hover:bg-crimson-900/50 text-crimson-300 flex items-center justify-center gap-2 text-xs font-semibold transition-all shadow-sm"
                >
                  <Camera className="w-4 h-4 text-crimson-400" />
                  <span>Câmera do Celular</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title="A câmera direta só está disponível ao acessar pelo celular"
                  className="py-2.5 px-3 rounded-xl border border-trigon-800 bg-trigon-950/60 text-trigon-500 cursor-not-allowed opacity-60 flex items-center justify-center gap-2 text-xs font-medium"
                >
                  <Camera className="w-4 h-4 text-trigon-600" />
                  <span>Câmera do Celular</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-trigon-900 border border-trigon-800 text-trigon-400">
                    Só celular
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Campo de link opcional mais discreto */}
          <div className="pt-0.5">
            <input
              type="url"
              value={customPhotoUrl.startsWith('data:') ? '' : customPhotoUrl}
              onChange={(e) => setCustomPhotoUrl(e.target.value)}
              placeholder="Ou cole uma URL direta da foto (https://...)"
              className="w-full px-3 py-1.5 rounded-lg bg-trigon-900/60 border border-trigon-800 text-trigon-300 text-[11px] focus:outline-none focus:border-crimson-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-trigon-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={auctions.length === 0}
            icon={<Gavel className="w-4 h-4" />}
          >
            {isTargetFinalizado
              ? `Salvar Lote no Leilão Passado #${selectedAuction?.code || ''}`
              : isCombo
                ? `Confirmar Lote Dupla / Combo (${selectedVariants.length} cartas)`
                : 'Confirmar e Reservar no Leilão'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
