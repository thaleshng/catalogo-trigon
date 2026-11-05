import React, { useState, useRef, useMemo } from 'react';
import {
  TcgAuction,
  TcgAuctionItem,
  Customer,
  AuctionPaymentStatus,
  AuctionShippingStatus,
} from '../../../../types';
import {
  formatCurrency,
  formatAuctionPeriod,
  formatDateTime,
  getSaoPauloDateTimeLocal,
  addDaysToDateTimeLocal,
  parseDateInputToIso,
} from '../../../../utils/formatters';
import { Modal } from '../../../../components/common/Modal';
import { Button } from '../../../../components/common/Button';
import { useToast } from '../../../../components/common/Toast';
import { auctionService } from '../../../../services/auctionService';
import { customerService } from '../../../../services/customerService';
import { cleanSetName, compareCardNumbers } from '../../../../config/tcgSetTranslations';
import {
  DEFAULT_CARD_CONDITION_OPTIONS,
  DEFAULT_CARD_LANGUAGE_OPTIONS,
  DEFAULT_CARD_FINISH_OPTIONS,
} from '../../../../config/tcgCardOptions';
import { storageUploadService } from '../../../../services/storageUploadService';
import {
  optimizeImage,
  optimizeImageFile,
  copyImageToClipboard,
} from '../../../../utils/imageUpload';
import { CustomerSearchSelect } from './CustomerSearchSelect';
import {
  ArrowLeft,
  Gavel,
  Play,
  CheckCircle2,
  XCircle,
  Copy,
  Camera,
  Image as ImageIcon,
  Package,
  Trash2,
  Gift,
  Layers,
  Edit2,
  Edit3,
  UploadCloud,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Clock,
} from 'lucide-react';

interface AuctionDetailsViewProps {
  auctionId: string;
  onBack: () => void;
  onOpenAddCardFromStock: (auctionId: string) => void;
  onRefreshAuctions: () => void;
  refreshTrigger?: number;
}

export const AuctionDetailsView: React.FC<AuctionDetailsViewProps> = ({
  auctionId,
  onBack,
  onOpenAddCardFromStock,
  onRefreshAuctions,
  refreshTrigger,
}) => {
  const { success, error, info } = useToast();

  const [loading, setLoading] = useState(true);
  const [auction, setAuction] = useState<TcgAuction | null>(null);
  const [items, setItems] = useState<TcgAuctionItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Modais de Lotes
  const [isCustomItemOpen, setIsCustomItemOpen] = useState(false);
  const [isArremateOpen, setIsArremateOpen] = useState(false);
  const [selectedItemForArremate, setSelectedItemForArremate] = useState<TcgAuctionItem | null>(null);

  // Form de Item Avulso
  const [customTitle, setCustomTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [customInitialPrice, setCustomInitialPrice] = useState('10');
  const [customBidStep, setCustomBidStep] = useState('2');
  const [customCostPrice, setCustomCostPrice] = useState('0');
  const [customIsFreebie, setCustomIsFreebie] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [customOutcome, setCustomOutcome] = useState<'ARREMATADO' | 'NAO_ARREMATADO'>('ARREMATADO');
  const [customWinningCustomerId, setCustomWinningCustomerId] = useState('');
  const [customFinalPrice, setCustomFinalPrice] = useState('10');
  const [customPaymentStatus, setCustomPaymentStatus] = useState<AuctionPaymentStatus>('PAGO');
  const [customShippingStatus, setCustomShippingStatus] = useState<AuctionShippingStatus>('RECEBIDO');
  const [submittingItem, setSubmittingItem] = useState(false);
  const [customUploadingPhoto, setCustomUploadingPhoto] = useState(false);
  const customFileInputPcRef = useRef<HTMLInputElement>(null);
  const customCameraMobileRef = useRef<HTMLInputElement>(null);

  const isMobileDevice = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const mobileRegex = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return mobileRegex.test(userAgent) || (window.innerWidth <= 768 && hasTouch);
  }, []);

  const handleCustomPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    try {
      setCustomUploadingPhoto(true);
      const compressedFile = await optimizeImageFile(rawFile, 1200, 0.82);

      try {
        const publicUrl = await storageUploadService.uploadImage(compressedFile, 'products');
        setCustomPhotoUrl(publicUrl);
        success('Foto otimizada e anexada com sucesso!');
      } catch {
        const base64 = await optimizeImage(rawFile, 1200);
        setCustomPhotoUrl(base64);
        success('Foto anexada localmente!');
      }
    } catch (err: any) {
      error(err.message || 'Erro ao processar imagem.');
    } finally {
      setCustomUploadingPhoto(false);
      e.target.value = '';
    }
  };

  // Form de Arremate
  const [arremateCustomerId, setArremateCustomerId] = useState('');
  const [arrematePriceStr, setArrematePriceStr] = useState('');
  const [arrematePaymentStatus, setArrematePaymentStatus] = useState<AuctionPaymentStatus>('PENDENTE');
  const [submittingArremate, setSubmittingArremate] = useState(false);

  // Upload de Foto por Câmera / Arquivo
  const [photoTargetItemId, setPhotoTargetItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de Edição do Leilão
  const [isEditAuctionOpen, setIsEditAuctionOpen] = useState(false);
  const [editAuctionTitle, setEditAuctionTitle] = useState('');
  const [editAuctionStartDate, setEditAuctionStartDate] = useState('');
  const [editAuctionEndDate, setEditAuctionEndDate] = useState('');
  const [editAuctionPaymentDeadline, setEditAuctionPaymentDeadline] = useState(48);
  const [editAuctionNotes, setEditAuctionNotes] = useState('');
  const [submittingAuctionEdit, setSubmittingAuctionEdit] = useState(false);

  // Estados de Edição do Lote / Item
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TcgAuctionItem | null>(null);
  const [editItemTitle, setEditItemTitle] = useState('');
  const [editItemSubtitle, setEditItemSubtitle] = useState('');
  const [editItemCondition, setEditItemCondition] = useState('NM');
  const [editItemLanguage, setEditItemLanguage] = useState('PT');
  const [editItemFinish, setEditItemFinish] = useState('NORMAL');
  const [editItemInitialPrice, setEditItemInitialPrice] = useState('10');
  const [editItemBidStep, setEditItemBidStep] = useState('2');
  const [editItemCostPrice, setEditItemCostPrice] = useState('0');
  const [editItemIsFreebie, setEditItemIsFreebie] = useState(false);
  const [editItemPhotoUrl, setEditItemPhotoUrl] = useState('');
  const [editItemNotes, setEditItemNotes] = useState('');
  const [submittingItemEdit, setSubmittingItemEdit] = useState(false);
  const [editItemUploadingPhoto, setEditItemUploadingPhoto] = useState(false);
  const editFileInputPcRef = useRef<HTMLInputElement>(null);
  const editCameraMobileRef = useRef<HTMLInputElement>(null);

  // Drag & Drop de Lotes
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const editCalculatedOptions = useMemo(() => {
    if (editItemIsFreebie) return [0, 0, 0, 0, 0];
    const init = Math.max(0, parseFloat(editItemInitialPrice) || 0);
    const step = Math.max(0.5, parseFloat(editItemBidStep) || 1);
    return auctionService.calculateBidOptions(init, step);
  }, [editItemIsFreebie, editItemInitialPrice, editItemBidStep]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [res, custs] = await Promise.all([
        auctionService.getAuctionById(auctionId),
        customerService.getCustomers(),
      ]);
      if (res) {
        setAuction(res.auction);
        setItems(res.items);
      }
      setCustomers(custs);
    } catch (err: any) {
      error(err.message || 'Erro ao carregar dados do leilão.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, [auctionId, refreshTrigger]);

  const handleStartAuction = async () => {
    if (!auction) return;
    const now = Date.now();
    const startTime = new Date(auction.startDate).getTime();
    if (now < startTime) {
      error(
        `O leilão só pode ser iniciado no horário programado (${formatDateTime(auction.startDate)}).`
      );
      return;
    }

    try {
      await auctionService.startAuction(auction.id);
      success(`Leilão #${auction.code} foi iniciado oficialmente!`);
      loadData();
      onRefreshAuctions();
    } catch (err: any) {
      error(err.message || 'Não foi possível iniciar o leilão.');
    }
  };

  const handleFinishAuction = async () => {
    if (!auction) return;
    const now = Date.now();
    const endTime = new Date(auction.endDate).getTime();
    if (now < endTime) {
      error(
        `O leilão não pode ser encerrado antes do horário de término programado (${formatDateTime(auction.endDate)}).`
      );
      return;
    }

    if (
      !window.confirm(
        `Deseja realmente finalizar o Leilão #${auction.code}? As cartas não arrematadas serão devolvidas automaticamente ao estoque.`
      )
    ) {
      return;
    }

    try {
      await auctionService.finishAuction(auction.id);
      success(`Leilão #${auction.code} finalizado com sucesso!`);
      loadData();
      onRefreshAuctions();
    } catch (err: any) {
      error(err.message || 'Erro ao finalizar leilão.');
    }
  };

  const handleOpenEditAuction = () => {
    if (!auction) return;
    setEditAuctionTitle(auction.title || '');
    setEditAuctionStartDate(getSaoPauloDateTimeLocal(auction.startDate));
    setEditAuctionEndDate(getSaoPauloDateTimeLocal(auction.endDate));
    setEditAuctionPaymentDeadline(auction.paymentDeadlineHours || 48);
    setEditAuctionNotes(auction.notes || '');
    setIsEditAuctionOpen(true);
  };

  const handleEditAuctionStartDateChange = (val: string) => {
    setEditAuctionStartDate(val);
    if (val) {
      setEditAuctionEndDate(addDaysToDateTimeLocal(val, 1));
    }
  };

  const handleSaveEditAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auction) return;
    try {
      setSubmittingAuctionEdit(true);
      await auctionService.updateAuction(auction.id, {
        title: editAuctionTitle.trim() || null,
        startDate: parseDateInputToIso(editAuctionStartDate),
        endDate: parseDateInputToIso(editAuctionEndDate),
        paymentDeadlineHours: editAuctionPaymentDeadline,
        notes: editAuctionNotes.trim() || null,
      });
      success(`Informações do Leilão #${auction.code} atualizadas com sucesso!`);
      setIsEditAuctionOpen(false);
      loadData();
      onRefreshAuctions();
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar leilão.');
    } finally {
      setSubmittingAuctionEdit(false);
    }
  };

  const handleOpenEditItemModal = (item: TcgAuctionItem) => {
    setEditingItem(item);
    setEditItemTitle(item.title || '');
    setEditItemSubtitle(item.subtitle || '');
    setEditItemCondition(item.condition || 'NM');
    setEditItemLanguage(item.language || 'PT');
    setEditItemFinish(item.finish || 'NORMAL');
    setEditItemInitialPrice(String(item.initialPrice ?? 10));
    setEditItemBidStep(String(item.bidStep ?? 2));
    setEditItemCostPrice(String(item.costPrice ?? 0));
    setEditItemIsFreebie(Boolean(item.isFreebie));
    setEditItemPhotoUrl(item.customPhotoUrl || item.apiImageUrl || '');
    setEditItemNotes(item.notes || '');
    setIsEditItemOpen(true);
  };

  const handleEditPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    try {
      setEditItemUploadingPhoto(true);
      const compressedFile = await optimizeImageFile(rawFile, 1200, 0.82);

      try {
        const publicUrl = await storageUploadService.uploadImage(compressedFile, 'products');
        setEditItemPhotoUrl(publicUrl);
        success('Foto otimizada e anexada com sucesso!');
      } catch {
        const base64 = await optimizeImage(rawFile, 1200);
        setEditItemPhotoUrl(base64);
        success('Foto anexada localmente!');
      }
    } catch (err: any) {
      error(err.message || 'Erro ao processar imagem.');
    } finally {
      setEditItemUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      setSubmittingItemEdit(true);
      await auctionService.updateAuctionItem(editingItem.id, {
        title: editItemTitle,
        subtitle: editItemSubtitle || null,
        condition: editItemCondition || null,
        language: editItemLanguage || null,
        finish: editItemFinish || null,
        initialPrice: editItemIsFreebie ? 0 : (parseFloat(editItemInitialPrice) || 0),
        bidStep: editItemIsFreebie ? 0 : (parseFloat(editItemBidStep) || 1),
        costPrice: parseFloat(editItemCostPrice) || 0,
        isFreebie: editItemIsFreebie,
        customPhotoUrl: editItemPhotoUrl || null,
        notes: editItemNotes || null,
      });
      success(`Lote atualizado com sucesso!`);
      setIsEditItemOpen(false);
      setEditingItem(null);
      loadData();
      onRefreshAuctions();
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar lote.');
    } finally {
      setSubmittingItemEdit(false);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === dropIndex) {
      setDraggedItemIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...items];
    const [moved] = newItems.splice(draggedItemIndex, 1);
    newItems.splice(dropIndex, 0, moved);

    setItems(newItems);
    setDraggedItemIndex(null);
    setDragOverIndex(null);

    try {
      await auctionService.reorderAuctionItems(newItems.map((i) => i.id));
      success('Ordem dos lotes atualizada com sucesso!');
    } catch (err: any) {
      error(err.message || 'Erro ao salvar reordenação dos lotes.');
      loadData();
    }
  };

  const handleMoveItemUpDown = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);

    setItems(newItems);
    try {
      await auctionService.reorderAuctionItems(newItems.map((i) => i.id));
      success('Ordem dos lotes atualizada!');
    } catch (err: any) {
      error(err.message || 'Erro ao salvar reordenação.');
      loadData();
    }
  };

  const handleOpenArremateModal = (item: TcgAuctionItem) => {
    if (auction?.status === 'PRE_LEILAO') {
      info('Este leilão ainda está em fase de pré-leilão. Inicie o leilão oficialmente para registrar arremates.');
      return;
    }
    setSelectedItemForArremate(item);
    const suggestedPrice =
      item.bidOptions && item.bidOptions.length > 0
        ? item.bidOptions[item.bidOptions.length - 1]
        : item.initialPrice;
    setArrematePriceStr(String(suggestedPrice));
    setArremateCustomerId(item.winningCustomerId || (customers[0]?.id || ''));
    setArrematePaymentStatus(item.paymentStatus || 'PENDENTE');
    setIsArremateOpen(true);
  };

  const handleConfirmArremate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForArremate) return;
    if (!arremateCustomerId) {
      error('Por favor, selecione o cliente que arrematou o lote.');
      return;
    }
    const finalPrice = parseFloat(arrematePriceStr.replace(',', '.'));
    if (isNaN(finalPrice) || finalPrice < 0) {
      error('Informe um valor de arremate válido.');
      return;
    }

    try {
      setSubmittingArremate(true);
      await auctionService.markItemArrematado({
        itemId: selectedItemForArremate.id,
        winningCustomerId: arremateCustomerId,
        finalPrice,
        paymentStatus: arrematePaymentStatus,
      });
      success(`Lote "${selectedItemForArremate.title}" marcado como arrematado!`);
      setIsArremateOpen(false);
      loadData();
      onRefreshAuctions();
    } catch (err: any) {
      error(err.message || 'Erro ao registrar arremate.');
    } finally {
      setSubmittingArremate(false);
    }
  };

  const handleMarkNaoArrematado = async (item: TcgAuctionItem) => {
    if (auction?.status === 'PRE_LEILAO') {
      info('Este leilão ainda está em fase de pré-leilão. Inicie o leilão oficialmente antes de marcar lotes.');
      return;
    }
    if (
      !window.confirm(
        `Marcar "${item.title}" como NÃO ARREMATADA? A carta voltará automaticamente ao estoque com +1 unidade.`
      )
    ) {
      return;
    }

    try {
      await auctionService.markItemNaoArrematado(item.id);
      success(`Lote marcado como não arrematado e devolvido ao estoque!`);
      loadData();
      onRefreshAuctions();
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar lote.');
    }
  };

  const handleRemoveItem = async (item: TcgAuctionItem) => {
    if (!window.confirm(`Remover "${item.title}" deste leilão?`)) return;
    try {
      await auctionService.removeAuctionItem(item.id);
      success('Item removido do leilão.');
      loadData();
      onRefreshAuctions();
    } catch (err: any) {
      error(err.message || 'Erro ao remover item.');
    }
  };

  const handleCreateCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auction) return;
    const isFinalizado = auction.status === 'FINALIZADO';
    if (isFinalizado && customOutcome === 'ARREMATADO' && !customWinningCustomerId) {
      error('Selecione o cliente que arrematou o item no histórico.');
      return;
    }
    try {
      setSubmittingItem(true);
      await auctionService.addCustomItemToAuction({
        auctionId: auction.id,
        title: customTitle,
        subtitle: customSubtitle || null,
        initialPrice: parseFloat(customInitialPrice) || 0,
        bidStep: parseFloat(customBidStep) || 1,
        costPrice: parseFloat(customCostPrice) || 0,
        isFreebie: customIsFreebie,
        customPhotoUrl: customPhotoUrl || null,
        pastOutcome: isFinalizado ? customOutcome : undefined,
        pastWinningCustomerId: isFinalizado && customOutcome === 'ARREMATADO' ? customWinningCustomerId : null,
        pastFinalPrice: isFinalizado && customOutcome === 'ARREMATADO' ? (parseFloat(customFinalPrice) || 0) : null,
        pastPaymentStatus: isFinalizado && customOutcome === 'ARREMATADO' ? customPaymentStatus : undefined,
        pastShippingStatus: isFinalizado && customOutcome === 'ARREMATADO' ? customShippingStatus : undefined,
      });
      success('Item avulso adicionado ao leilão!');
      setIsCustomItemOpen(false);
      setCustomTitle('');
      setCustomSubtitle('');
      setCustomPhotoUrl('');
      loadData();
      onRefreshAuctions();
    } catch (err: any) {
      error(err.message || 'Erro ao adicionar item avulso.');
    } finally {
      setSubmittingItem(false);
    }
  };

  // Cópia WhatsApp Mensagem 1: Legenda
  const handleCopyCaption = async (item: TcgAuctionItem) => {
    const text = auctionService.formatItemCaption(item);
    try {
      await navigator.clipboard.writeText(text);
      const activePhoto = item.customPhotoUrl || item.apiImageUrl;
      info(
        `📋 Legenda copiada!\n${activePhoto ? '💡 Dica: No WhatsApp, cole a foto com Ctrl+V e cole este texto na legenda.' : ''}`
      );
    } catch {
      error('Não foi possível copiar para a área de transferência.');
    }
  };

  // Cópia da FOTO diretamente para o Clipboard (Ctrl+V no WhatsApp Web)
  const handleCopyPhoto = async (item: TcgAuctionItem) => {
    const activePhoto = item.customPhotoUrl || item.apiImageUrl;
    if (!activePhoto) {
      error('Este lote não possui foto cadastrada.');
      return;
    }

    try {
      const ok = await copyImageToClipboard(activePhoto);
      if (ok) {
        success('📷 Foto copiada!\nCole com Ctrl+V no WhatsApp e depois cole a Legenda.');
      } else {
        error('Não foi possível copiar a foto automaticamente neste navegador.');
      }
    } catch {
      error('Erro ao copiar imagem.');
    }
  };

  // Cópia WhatsApp Mensagem 2: Enquete
  const handleCopyPoll = async (item: TcgAuctionItem) => {
    const text = auctionService.formatItemPoll(item);
    try {
      await navigator.clipboard.writeText(text);
      success('📊 Valores da enquete copiados para a área de transferência!');
    } catch {
      error('Não foi possível copiar para a área de transferência.');
    }
  };

  // Acionamento da Câmera do Celular / Upload
  const handleTriggerPhotoUpload = (itemId: string) => {
    setPhotoTargetItemId(itemId);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoTargetItemId) return;

    try {
      // Otimiza e redimensiona a foto no navegador antes de persistir
      const optimizedBase64 = await optimizeImage(file, 1200);
      await auctionService.updateItemPhoto(photoTargetItemId, optimizedBase64);
      success('Foto otimizada e atualizada com sucesso!');
      loadData();
    } catch (err: any) {
      error('Erro ao carregar foto do item.');
    } finally {
      e.target.value = '';
    }
  };

  if (loading || !auction) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-crimson-500/20 border-t-crimson-500 rounded-full animate-spin mx-auto" />
        <p className="text-xs text-trigon-400 font-mono">Carregando detalhes do leilão...</p>
      </div>
    );
  }

  const isEmAndamento = auction.status === 'EM_ANDAMENTO';
  const isPreLeilao = auction.status === 'PRE_LEILAO';
  const isFinalizado = auction.status === 'FINALIZADO';

  const nowTime = Date.now();
  const startTimeNum = new Date(auction.startDate).getTime();
  const endTimeNum = new Date(auction.endDate).getTime();
  const canStart = nowTime >= startTimeNum;
  const canFinish = nowTime >= endTimeNum;

  return (
    <div className="space-y-6">
      {/* Input invisível para câmera / foto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Barra de Navegação do Topo */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-2xl bg-trigon-950 border border-trigon-800">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-trigon-900 hover:bg-trigon-850 border border-trigon-750 text-trigon-300 hover:text-white transition-all shrink-0"
            title="Voltar para a lista de leilões"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-cinzel text-xl font-black text-white shrink-0">
                LEILÃO #{auction.code}
              </span>

              <button
                type="button"
                onClick={handleOpenEditAuction}
                className="px-2.5 py-1 rounded-lg bg-trigon-900 hover:bg-trigon-800 border border-trigon-750 text-trigon-300 hover:text-white transition-all inline-flex items-center gap-1.5 text-xs font-semibold shrink-0"
                title="Editar informações do leilão (título, datas, prazos)"
              >
                <Edit3 className="w-3.5 h-3.5 text-crimson-400" />
                <span>Editar Leilão</span>
              </button>

              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  isEmAndamento
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    : isFinalizado
                      ? 'bg-trigon-900 text-trigon-300 border border-trigon-750'
                      : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                }`}
              >
                {isEmAndamento
                  ? '● EM ANDAMENTO'
                  : isFinalizado
                    ? 'FINALIZADO'
                    : 'PRÉ-LEILÃO (EM MONTAGEM)'}
              </span>
            </div>

            <p className="text-xs text-trigon-400 mt-0.5 truncate">
              {auction.title ? `${auction.title} • ` : ''}Período: {formatAuctionPeriod(auction.startDate, auction.endDate)} (Prazo cobrança: {auction.paymentDeadlineHours}h)
            </p>
          </div>
        </div>

        {/* Botões de Ação do Ciclo do Leilão (Alinhados na mesma linha com altura uniforme) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
          {isPreLeilao && (
            canStart ? (
              <Button
                type="button"
                variant="primary"
                onClick={handleStartAuction}
                icon={<Play className="w-4 h-4 fill-current shrink-0" />}
                className="h-10 text-xs font-bold whitespace-nowrap"
              >
                Iniciar Leilão Oficial
              </Button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  error(
                    `O leilão só pode ser iniciado no horário programado (${formatDateTime(auction.startDate)}).`
                  )
                }
                className="h-10 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-trigon-900 border border-amber-500/40 text-amber-300 text-xs font-bold cursor-not-allowed opacity-90 shadow-sm whitespace-nowrap"
                title={`Início programado para ${formatDateTime(auction.startDate)}`}
              >
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Inicia às {new Date(auction.startDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            )
          )}

          {isEmAndamento && (
            canFinish ? (
              <Button
                type="button"
                variant="danger"
                onClick={handleFinishAuction}
                icon={<CheckCircle2 className="w-4 h-4 shrink-0" />}
                className="h-10 text-xs font-bold whitespace-nowrap"
              >
                Finalizar Leilão
              </Button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  error(
                    `O leilão não pode ser encerrado antes do horário de término programado (${formatDateTime(auction.endDate)}).`
                  )
                }
                className="h-10 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-trigon-900 border border-trigon-750 text-trigon-400 text-xs font-bold cursor-not-allowed opacity-90 shadow-sm whitespace-nowrap"
                title={`Término programado para ${formatDateTime(auction.endDate)}`}
              >
                <Clock className="w-4 h-4 text-trigon-400 shrink-0" />
                <span>Encerra às {new Date(auction.endDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            )
          )}

          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsCustomItemOpen(true)}
            icon={<Gift className="w-4 h-4 text-purple-400 shrink-0" />}
            className="h-10 text-xs font-bold whitespace-nowrap"
          >
            + Item Avulso / Especial
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={() => onOpenAddCardFromStock(auction.id)}
            icon={<Layers className="w-4 h-4 shrink-0" />}
            className="h-10 text-xs font-bold whitespace-nowrap"
          >
            + Adicionar Carta / Dupla do Estoque
          </Button>
        </div>
      </div>

      {/* Relatório Financeiro do Leilão Atual */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-trigon-950 border border-trigon-800">
          <span className="text-[10px] uppercase font-bold text-trigon-400 block tracking-wider">
            Total Lotes
          </span>
          <span className="font-mono text-xl font-bold text-white block mt-1">
            {items.length} un.
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-trigon-950 border border-trigon-800">
          <span className="text-[10px] uppercase font-bold text-trigon-400 block tracking-wider">
            Arrematadas
          </span>
          <span className="font-mono text-xl font-bold text-emerald-400 block mt-1">
            {items.filter((i) => i.status === 'ARREMATADO').length} un.
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-trigon-950 border border-trigon-800">
          <span className="text-[10px] uppercase font-bold text-trigon-400 block tracking-wider">
            Total Arrematado
          </span>
          <span className="font-mono text-xl font-bold text-emerald-400 block mt-1">
            {formatCurrency(auction.totalArrematado || 0)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-trigon-950 border border-trigon-800">
          <span className="text-[10px] uppercase font-bold text-trigon-400 block tracking-wider">
            Pendente
          </span>
          <span className="font-mono text-xl font-bold text-amber-300 block mt-1">
            {formatCurrency(auction.totalPendente || 0)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-trigon-950 border border-trigon-800">
          <span className="text-[10px] uppercase font-bold text-trigon-400 block tracking-wider">
            Custo das Cartas
          </span>
          <span className="font-mono text-xl font-bold text-trigon-300 block mt-1">
            {formatCurrency(auction.totalCusto || 0)}
          </span>
          <span className="text-[10px] text-trigon-500 block mt-0.5">
            Lotes arrematados
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-trigon-950 border border-trigon-800">
          <span className="text-[10px] uppercase font-bold text-trigon-400 block tracking-wider">
            Lucro Líquido
          </span>
          <span
            className={`font-mono text-xl font-bold block mt-1 ${
              (auction.totalLucro || 0) >= 0 ? 'text-emerald-400' : 'text-crimson-400'
            }`}
          >
            {formatCurrency(auction.totalLucro || 0)}
          </span>
        </div>
      </div>

      {/* Aviso Educativo da Câmera no Desktop & Atalhos WhatsApp */}
      <div className="hidden lg:flex items-center gap-3 p-3.5 rounded-xl bg-trigon-950 border border-trigon-800 text-xs text-trigon-300">
        <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
        <span>
          <strong>Dica Operacional WhatsApp:</strong> Clique em <span className="text-cyan-300 font-semibold">Copiar Foto</span> e cole com <kbd className="px-1.5 py-0.5 rounded bg-trigon-900 border border-trigon-750 text-[11px] font-mono text-cyan-200">Ctrl+V</kbd> no WhatsApp; em seguida cole a <span className="text-emerald-300 font-semibold">Msg 1 (Legenda)</span> no campo de legenda da foto.
        </span>
      </div>

      {/* Listagem de Lotes / Itens */}
      <div className="space-y-3">
        <h3 className="font-cinzel text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4 h-4 text-crimson-400" />
          <span>Lotes Cadastrados no Leilão ({items.length})</span>
        </h3>

        {items.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-trigon-950 border border-trigon-800 space-y-3">
            <Package className="w-8 h-8 text-trigon-600 mx-auto" />
            <p className="text-sm text-trigon-400">
              Nenhum lote foi adicionado a este leilão ainda.
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={() => onOpenAddCardFromStock(auction.id)}
            >
              + Adicionar Carta do Estoque
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item, idx) => {
              const sortedBundleCards =
                item.bundleCards && item.bundleCards.length > 0
                  ? [...item.bundleCards].sort((a, b) => compareCardNumbers(a.localId, b.localId))
                  : [];
              const activePhoto =
                item.customPhotoUrl ||
                (sortedBundleCards.length > 0 ? sortedBundleCards[0].imageUrl : null) ||
                item.apiImageUrl;
              const hasRealPhoto = Boolean(item.customPhotoUrl);
              const isArrematado = item.status === 'ARREMATADO';
              const isNaoArrematado = item.status === 'NAO_ARREMATADO';

              return (
                <div
                  key={item.id}
                  draggable={!isFinalizado}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`p-4 rounded-2xl border transition-all ${
                    dragOverIndex === idx
                      ? 'border-crimson-500 ring-2 ring-crimson-500/50 bg-crimson-950/20'
                      : isArrematado
                        ? 'bg-trigon-950/95 border-emerald-500/40 shadow-md shadow-emerald-950/20'
                        : isNaoArrematado
                          ? 'bg-trigon-950/80 border-rose-900/40 hover:border-rose-700/50'
                          : 'bg-trigon-950 border-trigon-800 hover:border-trigon-700'
                  }`}
                >
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    {/* Lado Esquerdo: Grip + Foto + Informações da Carta */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      {/* Grip e setas para reordenar */}
                      {!isFinalizado && (
                        <div className="flex flex-col items-center justify-center -space-y-0.5 text-trigon-500 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveItemUpDown(idx, 'UP')}
                            className="p-0.5 hover:text-white disabled:opacity-20 disabled:hover:text-trigon-500 transition-colors"
                            title="Mover lote para cima"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <div
                            className="cursor-grab active:cursor-grabbing p-1 hover:text-white transition-colors"
                            title="Arraste para reordenar a ordem dos lotes no leilão"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <button
                            type="button"
                            disabled={idx === items.length - 1}
                            onClick={() => handleMoveItemUpDown(idx, 'DOWN')}
                            className="p-0.5 hover:text-white disabled:opacity-20 disabled:hover:text-trigon-500 transition-colors"
                            title="Mover lote para baixo"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Thumbnail com foto real ou scan API */}
                      <div className="relative group shrink-0">
                        <div className="w-14 h-20 rounded-xl overflow-hidden bg-trigon-900 border border-trigon-800 flex items-center justify-center">
                          {activePhoto ? (
                            <img
                              src={activePhoto}
                              alt={item.title}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-trigon-600" />
                          )}
                        </div>

                        {/* Botão de Câmera sobre a foto */}
                        <button
                          type="button"
                          onClick={() => handleTriggerPhotoUpload(item.id)}
                          title="Tirar foto no celular ou trocar imagem"
                          className="absolute -bottom-1 -right-1 p-1 rounded-full bg-crimson-600 hover:bg-crimson-500 text-white shadow-md transition-all"
                        >
                          <Camera className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-trigon-400 shrink-0">
                            #{String(idx + 1).padStart(2, '0')}
                          </span>
                          <h4 className="font-bold text-white text-sm" title={item.title}>
                            {item.title}
                          </h4>
                          {isArrematado && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/60 flex items-center gap-1 shadow-sm shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>ARREMATADO</span>
                            </span>
                          )}
                          {isNaoArrematado && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-950/90 text-rose-300 border border-rose-500/50 flex items-center gap-1 shadow-sm shrink-0">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              <span>NÃO SAIU</span>
                            </span>
                          )}
                          {item.isBundle && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0">
                              <Layers className="w-3 h-3 text-amber-400" />
                              <span>DUPLA / COMBO</span>
                            </span>
                          )}
                          {hasRealPhoto && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/40 shrink-0">
                              📷 Foto Real
                            </span>
                          )}
                          {item.isFreebie && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-500/40 shrink-0">
                              🎁 BRINDE
                            </span>
                          )}
                        </div>

                        {/* Se for combo, exibe chips das cartas inclusas ordenadas numericamente */}
                        {item.isBundle && sortedBundleCards.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                            {sortedBundleCards.map((bc, bIdx) => (
                              <div
                                key={bIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-trigon-900 border border-trigon-750 text-[10px] text-trigon-300"
                              >
                                <span className="font-semibold text-white">{bc.name}</span>
                                {bc.localId && (
                                  <span className="font-mono text-trigon-400">
                                    #{bc.localId}{bc.totalCards ? `/${bc.totalCards}` : ''}
                                  </span>
                                )}
                                {bc.condition && (
                                  <span className="font-semibold text-emerald-400">
                                    {bc.condition}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-trigon-400 flex-wrap">
                          {item.subtitle && <span>{cleanSetName(item.subtitle)}</span>}
                          {item.condition && (
                            <span className="font-semibold text-trigon-200">
                              {auctionService.getConditionEmoji(item.condition)} {item.condition}
                            </span>
                          )}
                          {item.language && (
                            <span>
                              {auctionService.getLanguageFlag(item.language)} {item.language}
                            </span>
                          )}
                          {item.finish && item.finish !== 'NORMAL' && item.finish !== 'VARIADO' && (
                            <span className="text-amber-300">
                              ✨ {auctionService.formatFinishDisplay(item.finish) || item.finish}
                            </span>
                          )}
                          <span className="text-trigon-500">
                            Custo: {formatCurrency(item.costPrice)}
                          </span>
                        </div>

                        {/* Valores da Enquete */}
                        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] uppercase font-semibold ${
                              isArrematado
                                ? 'text-emerald-400'
                                : isNaoArrematado
                                  ? 'text-trigon-500'
                                  : 'text-trigon-400'
                            }`}
                          >
                            Enquete:
                          </span>
                          {(() => {
                            const finalPrice = item.finalPrice ?? item.initialPrice ?? 0;
                            const hasWinningMatch =
                              isArrematado &&
                              item.bidOptions.some(
                                (opt: number) => Math.abs(opt - finalPrice) < 0.01
                              );

                            return (
                              <>
                                {item.bidOptions.map((opt: number, oIdx: number) => {
                                  const isWinningOpt =
                                    isArrematado && Math.abs(opt - finalPrice) < 0.01;
                                  const isArremateImediato = oIdx === 4;

                                  if (isWinningOpt) {
                                    return (
                                      <span
                                        key={oIdx}
                                        title={`Lote arrematado nesta opção da enquete: ${formatCurrency(opt)}`}
                                        className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 font-extrabold shadow-sm flex items-center gap-1 ring-1 ring-emerald-500/30"
                                      >
                                        <span className="text-emerald-400 font-bold">✓</span>
                                        <span>{formatCurrency(opt)}</span>
                                        <span className="text-[9px] uppercase font-bold text-emerald-300 bg-emerald-900/80 px-1 py-0.2 rounded">
                                          Saiu
                                        </span>
                                      </span>
                                    );
                                  }

                                  if (isArrematado) {
                                    // Se o lote já foi arrematado por outro valor, a 5ª opção não fica dourada para não confundir
                                    return (
                                      <span
                                        key={oIdx}
                                        className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-trigon-900/60 border border-trigon-800/80 text-trigon-400"
                                      >
                                        {formatCurrency(opt)}
                                        {isArremateImediato ? ' ★' : ''}
                                      </span>
                                    );
                                  }

                                  if (isNaoArrematado) {
                                    return (
                                      <span
                                        key={oIdx}
                                        className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-trigon-900/40 border border-trigon-850 text-trigon-500"
                                      >
                                        {formatCurrency(opt)}
                                      </span>
                                    );
                                  }

                                  // Lote em aberto / pré-leilão: destaca a 5ª opção como Arremate Imediato
                                  return (
                                    <span
                                      key={oIdx}
                                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                                        isArremateImediato
                                          ? 'bg-amber-950/70 border border-amber-500/40 text-amber-300 font-bold'
                                          : 'bg-trigon-900 border border-trigon-800 text-trigon-300'
                                      }`}
                                    >
                                      {formatCurrency(opt)}
                                      {isArremateImediato ? ' ★' : ''}
                                    </span>
                                  );
                                })}

                                {/* Caso o valor arrematado não coincida com nenhum dos 5 lances da enquete (lance livre / contraproposta) */}
                                {isArrematado && !hasWinningMatch && finalPrice > 0 && (
                                  <span
                                    title={`Valor final do arremate: ${formatCurrency(finalPrice)}`}
                                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 font-extrabold shadow-sm flex items-center gap-1 ring-1 ring-emerald-500/30"
                                  >
                                    <span className="text-emerald-400 font-bold">✓</span>
                                    <span>Saiu por: {formatCurrency(finalPrice)}</span>
                                  </span>
                                )}

                                {isNaoArrematado && (
                                  <span className="text-[10px] text-rose-400/70 italic font-mono">
                                    (Sem lances)
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito: Actions de WhatsApp e Fechamento de Arremate */}
                    <div className="flex items-center justify-between xl:justify-end gap-3 shrink-0 pt-3 border-t border-trigon-800/60 xl:border-0 xl:pt-0">
                      {/* Botões Rápidos para o WhatsApp */}
                      <div className="flex items-center gap-1.5 bg-trigon-900/80 p-1 rounded-xl border border-trigon-800 shrink-0">
                        {activePhoto && (
                          <button
                            type="button"
                            onClick={() => handleCopyPhoto(item)}
                            title="Copiar Foto para Área de Transferência (Cole com Ctrl+V no WhatsApp Web)"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-trigon-950 hover:bg-cyan-950/60 border border-cyan-500/40 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-all shadow-sm"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Copiar Foto</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopyCaption(item)}
                          title="Copiar Legenda do Item (Mensagem 1 para colar na foto)"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-trigon-950 hover:bg-emerald-950/60 border border-emerald-500/40 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-all shadow-sm"
                        >
                          <Copy className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Msg 1 (Legenda)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyPoll(item)}
                          title="Copiar Enquete de Valores (Mensagem 2)"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-trigon-950 hover:bg-amber-950/60 border border-amber-500/40 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-all shadow-sm"
                        >
                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Msg 2 (Enquete)</span>
                        </button>
                      </div>

                      {/* Controle de Status e Arremate (Largura fixa 215px para garantir alinhamento perfeito de todas as linhas) */}
                      <div className="w-[215px] shrink-0">
                        {isArrematado ? (
                          <div className="flex items-center justify-between gap-2.5 p-2 px-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 shadow-md">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              </div>

                              <div className="text-left min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 truncate">
                                    Arrematado por
                                  </span>
                                  {item.paymentStatus && (
                                    <span
                                      className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase shrink-0 ${
                                        item.paymentStatus === 'PAGO'
                                          ? 'bg-emerald-900/90 text-emerald-200 border border-emerald-500/40'
                                          : item.paymentStatus === 'VENCIDO'
                                            ? 'bg-rose-900/90 text-rose-200 border border-rose-500/40'
                                            : 'bg-amber-900/90 text-amber-200 border border-amber-500/40'
                                      }`}
                                    >
                                      {item.paymentStatus}
                                    </span>
                                  )}
                                </div>
                                <p
                                  className="font-bold text-white text-xs truncate max-w-[105px]"
                                  title={item.winningCustomer?.name}
                                >
                                  {item.winningCustomer?.name || 'Cliente'}
                                </p>
                                <p className="font-mono text-sm font-extrabold text-emerald-400 leading-tight">
                                  {formatCurrency(item.finalPrice || item.initialPrice)}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenArremateModal(item)}
                              className="p-1.5 rounded-lg bg-trigon-900 hover:bg-trigon-800 border border-trigon-750 text-trigon-300 hover:text-white transition-colors shrink-0"
                              title="Editar arremate"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : isNaoArrematado ? (
                          <div className="flex items-center justify-between gap-2.5 p-2 px-3 rounded-xl bg-rose-950/20 border border-rose-500/30 shadow-md">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                                <XCircle className="w-4 h-4 text-rose-400" />
                              </div>

                              <div className="text-left min-w-0">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 block truncate">
                                  Não Saiu
                                </span>
                                <span className="text-[11px] text-trigon-400 font-medium block truncate">
                                  Estoque devolvido
                                </span>
                              </div>
                            </div>

                            {!isFinalizado && (
                              <button
                                type="button"
                                onClick={() => handleOpenArremateModal(item)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-xs font-semibold text-emerald-300 transition-colors shrink-0"
                                title="Arrematar este lote"
                              >
                                Arrematar
                              </button>
                            )}
                          </div>
                        ) : isPreLeilao ? (
                          <div className="flex items-center justify-end">
                            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs font-semibold text-amber-300/80">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Aguardando Início</span>
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => handleOpenArremateModal(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all shrink-0"
                            >
                              <Gavel className="w-3.5 h-3.5" />
                              <span>Arrematar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMarkNaoArrematado(item)}
                              title="Não arrematada (devolve ao estoque)"
                              className="px-2.5 py-2 rounded-xl bg-trigon-900 hover:bg-trigon-850 border border-trigon-750 text-xs text-trigon-400 hover:text-white transition-all shrink-0"
                            >
                              Não Saiu
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Editar Lote (Valores, Fotos, Brinde, Condição, etc.) */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditItemModal(item)}
                        title="Editar lote (valores, fotos, brinde, condição, acabamento, etc.)"
                        className="p-2 rounded-lg text-trigon-400 hover:text-amber-300 hover:bg-amber-950/40 transition-colors shrink-0"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Excluir Lote */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item)}
                        title="Remover lote do leilão"
                        className="p-2 rounded-lg text-trigon-500 hover:text-crimson-400 hover:bg-crimson-950/40 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Dar Arremate no Lote */}
      <Modal
        isOpen={isArremateOpen}
        onClose={() => setIsArremateOpen(false)}
        title={`Registrar Arremate — ${selectedItemForArremate?.title || ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleConfirmArremate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Cliente Vencedor *
            </label>
            <CustomerSearchSelect
              customers={customers}
              selectedCustomerId={arremateCustomerId}
              onSelectCustomer={(id) => setArremateCustomerId(id)}
              placeholder="Pesquise o cliente por nome..."
              accentColor="crimson"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
              Valor Final do Arremate (R$) *
            </label>

            {/* Atalhos Rápidos das 5 Opções */}
            {selectedItemForArremate?.bidOptions && (
              <div className="mb-2">
                <span className="text-[10px] text-trigon-400 block mb-1">
                  Clique para selecionar uma das opções da enquete:
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {selectedItemForArremate.bidOptions.map((opt: number, i: number) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setArrematePriceStr(String(opt))}
                      className={`p-2 rounded-lg font-mono text-xs font-bold border transition-all ${
                        parseFloat(arrematePriceStr) === opt
                          ? 'bg-crimson-600 text-white border-crimson-400'
                          : 'bg-trigon-950 text-trigon-200 border-trigon-800 hover:border-trigon-700'
                      }`}
                    >
                      {formatCurrency(opt)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              type="number"
              step="0.01"
              min="0"
              value={arrematePriceStr}
              onChange={(e) => setArrematePriceStr(e.target.value)}
              placeholder="Digite livremente o valor final..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono focus:outline-none focus:border-crimson-500 font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Status Inicial do Pagamento
            </label>
            <select
              value={arrematePaymentStatus}
              onChange={(e) => setArrematePaymentStatus(e.target.value as AuctionPaymentStatus)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            >
              <option value="PENDENTE">Pendente (Aguardando prazo de 48h)</option>
              <option value="PAGO">Pago (Comprovante já recebido)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-trigon-800">
            <Button type="button" variant="secondary" onClick={() => setIsArremateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={submittingArremate}>
              Confirmar Arremate
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Item Especial / Avulso */}
      <Modal
        isOpen={isCustomItemOpen}
        onClose={() => setIsCustomItemOpen(false)}
        title="Adicionar Item Especial / Avulso ao Leilão"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateCustomItem} className="space-y-4">
          <p className="text-xs text-trigon-400">
            Use para adicionar produtos que não são cartas avulsas (ex: playmats, sleeves, boosters, pelúcias ou kits).
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Nome do Item *
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Ex: Playmat Oficial Charizard ou Shield Dragon Shield"
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Subtítulo / Descrição Rápida (Opcional)
            </label>
            <input
              type="text"
              value={customSubtitle}
              onChange={(e) => setCustomSubtitle(e.target.value)}
              placeholder="Ex: Edição Limitada / Lacrado"
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Valor Inicial (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customInitialPrice}
                onChange={(e) => setCustomInitialPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono focus:outline-none focus:border-crimson-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Incremento (R$) *
              </label>
              <input
                type="number"
                step="0.50"
                min="0.50"
                max="100"
                value={customBidStep}
                onChange={(e) => setCustomBidStep(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono focus:outline-none focus:border-crimson-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Custo do Item (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customCostPrice}
                onChange={(e) => setCustomCostPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono focus:outline-none focus:border-crimson-500"
              />
            </div>
          </div>

          {/* Foto do Item Especial / Avulso (Upload do PC vs Câmera do Celular) */}
          <div className="p-3.5 rounded-2xl bg-trigon-950 border border-trigon-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase text-trigon-300">
                Foto do Item (Opcional)
              </label>
              {customPhotoUrl && (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Foto anexada
                </span>
              )}
            </div>

            {/* Inputs ocultos acionados pelos botões */}
            <input
              ref={customFileInputPcRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCustomPhotoPicked}
            />
            <input
              ref={customCameraMobileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCustomPhotoPicked}
            />

            {/* Prévia da Foto */}
            {customPhotoUrl ? (
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-trigon-900 border border-emerald-500/40">
                <div className="w-14 h-16 rounded-lg overflow-hidden bg-black flex items-center justify-center border border-trigon-750 shrink-0">
                  <img
                    src={customPhotoUrl}
                    alt="Prévia Foto"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">Foto Anexada</p>
                  <p className="text-[10px] text-emerald-400 font-mono">
                    {customPhotoUrl.startsWith('data:') ? 'Imagem salva localmente' : 'Imagem hospedada online'}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      type="button"
                      onClick={() => customFileInputPcRef.current?.click()}
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
                  disabled={customUploadingPhoto}
                  onClick={() => customFileInputPcRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl border border-trigon-750 bg-trigon-900 hover:border-trigon-600 hover:bg-trigon-850 text-white flex items-center justify-center gap-2 text-xs font-medium transition-all group shadow-sm"
                >
                  <UploadCloud className="w-4 h-4 text-trigon-400 group-hover:text-white transition-colors" />
                  <span>{customUploadingPhoto ? 'Enviando...' : 'Upload do PC'}</span>
                </button>

                {/* Opção 2: Câmera do Celular */}
                {isMobileDevice ? (
                  <button
                    type="button"
                    disabled={customUploadingPhoto}
                    onClick={() => customCameraMobileRef.current?.click()}
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

            {/* Campo de URL opcional mais discreto */}
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

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="customIsFreebie"
              checked={customIsFreebie}
              onChange={(e) => setCustomIsFreebie(e.target.checked)}
              className="rounded border-trigon-700 bg-trigon-900 text-crimson-600 focus:ring-crimson-500"
            />
            <label htmlFor="customIsFreebie" className="text-xs text-trigon-300 cursor-pointer">
              🎁 Marcar este item como <strong>Brinde</strong> (valor de venda será R$ 0,00)
            </label>
          </div>

          {/* Se o Leilão já for Finalizado: Configurações de Histórico */}
          {auction?.status === 'FINALIZADO' && (
            <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/40 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold text-xs uppercase tracking-wide">
                  📜 Registro Histórico (Leilão Finalizado #{auction.code})
                </span>
              </div>
              <p className="text-[11px] text-amber-300/80">
                Como este leilão já encerrou, o item será registrado diretamente com o resultado histórico.
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  Resultado do Item no Leilão *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomOutcome('ARREMATADO')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      customOutcome === 'ARREMATADO'
                        ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500'
                        : 'bg-trigon-950 text-trigon-400 border-trigon-800 hover:border-trigon-700'
                    }`}
                  >
                    🏆 Arrematado
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomOutcome('NAO_ARREMATADO')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      customOutcome === 'NAO_ARREMATADO'
                        ? 'bg-rose-600/30 text-rose-300 border-rose-500'
                        : 'bg-trigon-950 text-trigon-400 border-trigon-800 hover:border-trigon-700'
                    }`}
                  >
                    ✖ Não Arrematado
                  </button>
                </div>
              </div>

              {customOutcome === 'ARREMATADO' && (
                <div className="space-y-3 pt-1 border-t border-amber-500/20">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                      Cliente Arrematante *
                    </label>
                    <CustomerSearchSelect
                      customers={customers}
                      selectedCustomerId={customWinningCustomerId}
                      onSelectCustomer={(id) => setCustomWinningCustomerId(id)}
                      placeholder="Pesquise o cliente por nome..."
                      accentColor="amber"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold uppercase text-trigon-300 mb-1.5 min-h-[1.75rem] flex items-end">
                        Valor Arremate (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customFinalPrice}
                        onChange={(e) => setCustomFinalPrice(e.target.value)}
                        className="h-10 w-full px-3.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono font-bold focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-xs font-semibold uppercase text-trigon-300 mb-1.5 min-h-[1.75rem] flex items-end">
                        Status Pagamento
                      </label>
                      <select
                        value={customPaymentStatus}
                        onChange={(e) => setCustomPaymentStatus(e.target.value as AuctionPaymentStatus)}
                        className="h-10 w-full px-3.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs font-medium focus:outline-none focus:border-amber-500"
                      >
                        <option value="PAGO">Pago</option>
                        <option value="PENDENTE">Pendente</option>
                        <option value="VENCIDO">Vencido</option>
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-xs font-semibold uppercase text-trigon-300 mb-1.5 min-h-[1.75rem] flex items-end">
                        Situação de Envio
                      </label>
                      <select
                        value={customShippingStatus}
                        onChange={(e) => setCustomShippingStatus(e.target.value as AuctionShippingStatus)}
                        className="h-10 w-full px-3.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs font-medium focus:outline-none focus:border-amber-500"
                      >
                        <option value="RECEBIDO">Recebido</option>
                        <option value="ENVIADO">Enviado</option>
                        <option value="SOLICITADO">Solicitado</option>
                        <option value="NAO_SOLICITADO">Não Solicitado</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-trigon-800">
            <Button type="button" variant="secondary" onClick={() => setIsCustomItemOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={submittingItem}>
              Adicionar ao Leilão
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Informações do Leilão */}
      <Modal
        isOpen={isEditAuctionOpen}
        onClose={() => setIsEditAuctionOpen(false)}
        title={`Editar Leilão #${auction.code}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEditAuction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Título / Descrição do Leilão (Opcional)
            </label>
            <input
              type="text"
              value={editAuctionTitle}
              onChange={(e) => setEditAuctionTitle(e.target.value)}
              placeholder="Ex: Leilão Especial de Fim de Semana"
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Data e Horário de Início *
              </label>
              <input
                type="datetime-local"
                value={editAuctionStartDate}
                onChange={(e) => handleEditAuctionStartDateChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono focus:outline-none focus:border-crimson-500"
                required
              />
              <span className="text-[10px] text-trigon-500 mt-1 block">
                Ao alterar o início, o término avança 1 dia automaticamente.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Data e Horário de Término *
              </label>
              <input
                type="datetime-local"
                value={editAuctionEndDate}
                onChange={(e) => setEditAuctionEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono focus:outline-none focus:border-crimson-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Prazo para Pagamento dos Arremates
            </label>
            <select
              value={editAuctionPaymentDeadline}
              onChange={(e) => setEditAuctionPaymentDeadline(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            >
              <option value={24}>24 horas (1 dia após o encerramento)</option>
              <option value={48}>48 horas (Padrão — 2 dias após encerramento)</option>
              <option value={72}>72 horas (3 dias após encerramento)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Observações Gerais (Opcional)
            </label>
            <textarea
              rows={2}
              value={editAuctionNotes}
              onChange={(e) => setEditAuctionNotes(e.target.value)}
              placeholder="Instruções internas ou notas sobre o evento..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-trigon-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditAuctionOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={submittingAuctionEdit}>
              Salvar Alterações do Leilão
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Lote do Leilão (Valores, Fotos, Brinde, Condição, etc.) */}
      <Modal
        isOpen={isEditItemOpen}
        onClose={() => {
          setIsEditItemOpen(false);
          setEditingItem(null);
        }}
        title={`Editar Lote — ${editingItem?.title || ''}`}
        maxWidth="xl"
      >
        <form onSubmit={handleSaveEditItem} className="space-y-4">
          {/* Inputs ocultos de upload */}
          <input
            ref={editFileInputPcRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleEditPhotoPicked}
          />
          <input
            ref={editCameraMobileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleEditPhotoPicked}
          />

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Título / Nome do Lote *
            </label>
            <input
              type="text"
              value={editItemTitle}
              onChange={(e) => setEditItemTitle(e.target.value)}
              placeholder="Ex: Charizard ex ou Combo Charizard + Blastoise"
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Subtítulo / Coleção (Opcional)
            </label>
            <input
              type="text"
              value={editItemSubtitle}
              onChange={(e) => setEditItemSubtitle(e.target.value)}
              placeholder="Ex: 151 CN • 096C/151 ou Terastal Gathering"
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Estado / Condição
              </label>
              <select
                value={editItemCondition}
                onChange={(e) => setEditItemCondition(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs font-semibold focus:outline-none focus:border-crimson-500"
              >
                {DEFAULT_CARD_CONDITION_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Idioma
              </label>
              <select
                value={editItemLanguage}
                onChange={(e) => setEditItemLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs font-semibold focus:outline-none focus:border-crimson-500"
              >
                {DEFAULT_CARD_LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Acabamento
              </label>
              <select
                value={editItemFinish}
                onChange={(e) => setEditItemFinish(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs font-semibold focus:outline-none focus:border-crimson-500"
              >
                {DEFAULT_CARD_FINISH_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editItemIsFreebie"
              checked={editItemIsFreebie}
              onChange={(e) => setEditItemIsFreebie(e.target.checked)}
              className="rounded border-trigon-700 bg-trigon-900 text-crimson-600 focus:ring-crimson-500"
            />
            <label htmlFor="editItemIsFreebie" className="text-xs text-trigon-300 cursor-pointer">
              🎁 Marcar este lote como <strong>Brinde</strong> (lance inicial e opções serão R$ 0,00)
            </label>
          </div>

          {!editItemIsFreebie && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                    Lance Inicial (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editItemInitialPrice}
                    onChange={(e) => setEditItemInitialPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono font-bold focus:outline-none focus:border-crimson-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                    Incremento (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0.50"
                    max="100"
                    value={editItemBidStep}
                    onChange={(e) => setEditItemBidStep(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono font-bold focus:outline-none focus:border-crimson-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                    Custo do Lote (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editItemCostPrice}
                    onChange={(e) => setEditItemCostPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-mono focus:outline-none focus:border-crimson-500"
                  />
                </div>
              </div>

              {/* Prévia da Enquete WhatsApp com as 5 opções calculadas dinamicamente */}
              <div className="p-3 rounded-xl bg-trigon-900/60 border border-trigon-800">
                <span className="text-[10px] uppercase font-bold text-trigon-400 block mb-1.5">
                  Prévia da Enquete WhatsApp (5 Opções Calculadas):
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {editCalculatedOptions.map((opt, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg text-center font-mono text-xs font-bold border ${
                        i === 4
                          ? 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                          : 'bg-trigon-950 border-trigon-800 text-trigon-200'
                      }`}
                    >
                      <span>{formatCurrency(opt)}</span>
                      {i === 4 && (
                        <span className="block text-[9px] text-amber-400 font-semibold mt-0.5">
                          ★ Imediato
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Foto do Lote */}
          <div className="p-3.5 rounded-2xl bg-trigon-950 border border-trigon-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase text-trigon-300">
                Foto do Lote
              </label>
              {editItemPhotoUrl && (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Foto ativa
                </span>
              )}
            </div>

            {editItemPhotoUrl ? (
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-trigon-900 border border-emerald-500/40">
                <div className="w-14 h-16 rounded-lg overflow-hidden bg-black flex items-center justify-center border border-trigon-750 shrink-0">
                  <img
                    src={editItemPhotoUrl}
                    alt="Prévia Foto Lote"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">Foto Atual do Lote</p>
                  <p className="text-[10px] text-trigon-400 truncate font-mono mt-0.5">
                    {editItemPhotoUrl.startsWith('data:') ? 'Imagem salva localmente' : editItemPhotoUrl}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      type="button"
                      onClick={() => editFileInputPcRef.current?.click()}
                      className="text-[11px] text-cyan-300 hover:text-cyan-200 underline font-medium"
                    >
                      Trocar foto (Upload PC)
                    </button>
                    {isMobileDevice && (
                      <button
                        type="button"
                        onClick={() => editCameraMobileRef.current?.click()}
                        className="text-[11px] text-amber-300 hover:text-amber-200 underline font-medium"
                      >
                        Tirar nova foto
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditItemPhotoUrl('')}
                      className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="w-3 h-3" /> Remover Foto
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={editItemUploadingPhoto}
                  onClick={() => editFileInputPcRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl border border-trigon-750 bg-trigon-900 hover:border-trigon-600 hover:bg-trigon-850 text-white flex items-center justify-center gap-2 text-xs font-medium transition-all group shadow-sm"
                >
                  <UploadCloud className="w-4 h-4 text-trigon-400 group-hover:text-white transition-colors" />
                  <span>{editItemUploadingPhoto ? 'Enviando...' : 'Upload do PC'}</span>
                </button>

                {isMobileDevice ? (
                  <button
                    type="button"
                    disabled={editItemUploadingPhoto}
                    onClick={() => editCameraMobileRef.current?.click()}
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

            <div className="pt-0.5">
              <input
                type="url"
                value={editItemPhotoUrl.startsWith('data:') ? '' : editItemPhotoUrl}
                onChange={(e) => setEditItemPhotoUrl(e.target.value)}
                placeholder="Ou cole uma URL direta da imagem (https://...)"
                className="w-full px-3 py-1.5 rounded-lg bg-trigon-900/60 border border-trigon-800 text-trigon-300 text-[11px] focus:outline-none focus:border-crimson-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Observações do Lote (Opcional)
            </label>
            <textarea
              rows={2}
              value={editItemNotes}
              onChange={(e) => setEditItemNotes(e.target.value)}
              placeholder="Ex: Detalhe no canto superior direito / Carta em perfeito estado"
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-trigon-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsEditItemOpen(false);
                setEditingItem(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={submittingItemEdit}>
              Salvar Alterações do Lote
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
