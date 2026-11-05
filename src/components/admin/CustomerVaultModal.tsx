import React, { useState, useEffect, useMemo } from 'react';
import {
  Customer,
  TcgAuctionItem,
  CustomerVaultStockItem,
  TcgCardVariant,
  AuctionShippingStatus,
  CustomerShipmentPackage,
  ShipmentCarrier,
  ShipmentStatus,
} from '../../types';
import { formatCurrency, formatPhoneMask } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';
import { customerVaultService } from '../../services/customerVaultService';
import { cardStockService } from '../../services/cardStockService';
import { matchesCardQuery } from '../../services/tcgdexService';
import {
  Gavel,
  Plus,
  Trash2,
  Copy,
  Truck,
  Sparkles,
  Search,
  Layers,
  MapPin,
  MessageSquare,
  Check,
  X,
  Compass,
  Package,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cleanSetName } from '../../config/tcgSetTranslations';

interface CustomerVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSuccess?: () => void;
}

const QUEST_TARGET_DEFAULT = 100;

export const CustomerVaultModal: React.FC<CustomerVaultModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSuccess,
}) => {
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'vault' | 'history'>('vault');
  const [loading, setLoading] = useState(true);
  const [auctionItems, setAuctionItems] = useState<TcgAuctionItem[]>([]);
  const [stockItems, setStockItems] = useState<CustomerVaultStockItem[]>([]);
  const [shipments, setShipments] = useState<CustomerShipmentPackage[]>([]);
  const [expandedShipmentIds, setExpandedShipmentIds] = useState<Set<string>>(new Set());

  // Estoque disponível para adicionar
  const [availableStock, setAvailableStock] = useState<TcgCardVariant[]>([]);
  const [isAddingStockOpen, setIsAddingStockOpen] = useState(false);
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState('');

  // Despacho e Modal de Expedição
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatchTrackingCode, setDispatchTrackingCode] = useState('');
  const [dispatchCarrier, setDispatchCarrier] = useState<ShipmentCarrier>('CORREIOS_MINI');
  const [dispatchCustomCarrier, setDispatchCustomCarrier] = useState('');
  const [dispatchShippingCost, setDispatchShippingCost] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [submittingDispatch, setSubmittingDispatch] = useState(false);
  const [registerQuestOnDispatch, setRegisterQuestOnDispatch] = useState(true);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedShipmentId, setCopiedShipmentId] = useState<string | null>(null);

  const loadVaultData = async () => {
    if (!customer) return;
    try {
      setLoading(true);
      const [aucItems, stkVaultItems, stockVariants, clientShipments] = await Promise.all([
        customerVaultService.getCustomerVaultAuctionItems(customer.id),
        Promise.resolve(customerVaultService.getCustomerVaultStockItems(customer.id)),
        cardStockService.getVariants(),
        Promise.resolve(customerVaultService.getCustomerShipments(customer.id)),
      ]);

      setAuctionItems(aucItems);
      setStockItems(stkVaultItems);
      // Filtra apenas variantes com estoque disponível (> 0)
      setAvailableStock(stockVariants.filter((v) => v.quantity > 0));
      setShipments(clientShipments);
    } catch (err: any) {
      error(err.message || 'Erro ao carregar itens da gaveta de envio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customer) {
      loadVaultData();
      setActiveTab('vault');
      setIsAddingStockOpen(false);
      setStockSearchTerm('');
      setIsDispatchModalOpen(false);
    }
  }, [isOpen, customer]);

  // Totais e Quest
  const subtotalAuction = useMemo(() => {
    return auctionItems.reduce(
      (acc, i) => acc + (i.isFreebie ? 0 : Number(i.finalPrice || i.initialPrice || 0)),
      0
    );
  }, [auctionItems]);

  const subtotalStock = useMemo(() => {
    return stockItems.reduce((acc, i) => acc + Number(i.unitPrice || 0) * (i.quantity || 1), 0);
  }, [stockItems]);

  const grandTotal = subtotalAuction + subtotalStock;
  const isQuestEligible = grandTotal >= QUEST_TARGET_DEFAULT;
  const missingForQuest = Math.max(0, QUEST_TARGET_DEFAULT - grandTotal);
  const questProgressPct = Math.min(100, Math.round((grandTotal / QUEST_TARGET_DEFAULT) * 100));

  // Filtro de cartas do estoque para adicionar
  const filteredStock = useMemo(() => {
    if (!stockSearchTerm.trim()) {
      return availableStock.slice(0, 8);
    }
    return availableStock
      .filter((v) => matchesCardQuery(stockSearchTerm, v.card))
      .slice(0, 15);
  }, [availableStock, stockSearchTerm]);

  // Ações
  const handleToggleShippingStatus = async (
    itemId: string,
    isStockItem: boolean,
    currentStatus: AuctionShippingStatus
  ) => {
    const nextStatus: AuctionShippingStatus =
      currentStatus === 'SOLICITADO' ? 'NAO_SOLICITADO' : 'SOLICITADO';
    try {
      await customerVaultService.updateItemShippingStatus(itemId, isStockItem, nextStatus);
      if (isStockItem) {
        setStockItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, shippingStatus: nextStatus } : i))
        );
      } else {
        setAuctionItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, shippingStatus: nextStatus } : i))
        );
      }
      success(
        nextStatus === 'SOLICITADO'
          ? 'Item marcado como Solicitado para Envio!'
          : 'Item mantido na Gaveta (Não Solicitado).'
      );
    } catch (err: any) {
      error(err.message || 'Erro ao alterar situação de envio.');
    }
  };

  const handleStartAddStock = (variant: TcgCardVariant) => {
    setAddingVariantId(variant.id);
    const suggested = variant.salePrice || variant.referenceValue || 10;
    setCustomPriceInput(String(suggested));
  };

  const handleConfirmAddStock = async (variant: TcgCardVariant) => {
    if (!customer) return;
    const finalPrice = parseFloat(customPriceInput.replace(',', '.'));
    if (isNaN(finalPrice) || finalPrice < 0) {
      error('Informe um valor válido para o item.');
      return;
    }

    try {
      const added = await customerVaultService.addStockItemToVault({
        customerId: customer.id,
        customerName: customer.name,
        variant,
        unitPrice: finalPrice,
      });

      setStockItems((prev) => [added, ...prev]);
      setAddingVariantId(null);
      setCustomPriceInput('');
      success(`"${added.name}" adicionado à gaveta e reservado do estoque!`);

      // Atualiza o saldo local na lista de disponíveis
      setAvailableStock((prev) =>
        prev
          .map((v) => (v.id === variant.id ? { ...v, quantity: v.quantity - 1 } : v))
          .filter((v) => v.quantity > 0)
      );
    } catch (err: any) {
      error(err.message || 'Erro ao adicionar item do estoque.');
    }
  };

  const handleRemoveStockItem = async (item: CustomerVaultStockItem) => {
    if (!customer) return;
    const qty = item.quantity || 1;
    if (
      !window.confirm(
        `Remover "${item.name}" da gaveta? ${
          qty > 1 ? `As ${qty} unidades serão estornadas` : 'A unidade será estornada'
        } ao estoque.`
      )
    ) {
      return;
    }

    try {
      await customerVaultService.removeStockItemFromVault(item.id, customer.name);
      setStockItems((prev) => prev.filter((i) => i.id !== item.id));
      success(`Item removido da gaveta e estornado ao estoque.`);
      // Recarrega lista de variantes disponíveis
      const fresh = await cardStockService.getVariants();
      setAvailableStock(fresh.filter((v) => v.quantity > 0));
      if (onSuccess) onSuccess();
    } catch (err: any) {
      error(err.message || 'Erro ao remover item da gaveta.');
    }
  };

  const handleCopyWhatsApp = async () => {
    if (!customer) return;
    const summary = customerVaultService.formatVaultWhatsAppSummary({
      customer,
      auctionItems,
      stockItems,
      totalValue: grandTotal,
      questTarget: QUEST_TARGET_DEFAULT,
    });

    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
      success('Resumo completo da Gaveta copiado para a área de transferência!');
    } catch {
      error('Não foi possível copiar o texto.');
    }
  };

  const handleCopyAddress = async () => {
    if (!customer) return;
    const lines = [
      `Destinatário: ${customer.name}`,
      `Telefone: ${customer.phone}`,
      `Endereço: ${customer.street || ''}, ${customer.number || 'S/N'}${customer.complement ? ` - ${customer.complement}` : ''}`,
      `Bairro: ${customer.neighborhood || ''}`,
      `Cidade/UF: ${customer.city || ''}/${customer.state || ''}`,
      `CEP: ${customer.cep || ''}`,
    ];
    if (customer.referencePoint) {
      lines.push(`Ponto de Referência: ${customer.referencePoint}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2500);
      success('Etiqueta de envio copiada!');
    } catch {
      error('Não foi possível copiar.');
    }
  };

  const handleOpenDispatchModal = () => {
    if (!customer) return;
    const stockUnits = stockItems.reduce((acc, i) => acc + (i.quantity || 1), 0);
    const totalUnits = auctionItems.length + stockUnits;
    if (totalUnits === 0) {
      error('Não há itens na gaveta deste cliente para despachar.');
      return;
    }
    setDispatchTrackingCode('');
    setDispatchCarrier('CORREIOS_MINI');
    setDispatchCustomCarrier('');
    setDispatchShippingCost('');
    setDispatchNotes('');
    setIsDispatchModalOpen(true);
  };

  const handleConfirmDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    try {
      setSubmittingDispatch(true);
      const res = await customerVaultService.dispatchFullVault({
        customer,
        auctionItems,
        stockItems,
        registerQuestClosure: isQuestEligible && registerQuestOnDispatch,
        trackingCode: dispatchTrackingCode.trim() || undefined,
        carrier: dispatchCarrier,
        customCarrierName: dispatchCustomCarrier.trim() || undefined,
        shippingCost: dispatchShippingCost ? parseFloat(dispatchShippingCost.replace(',', '.')) : undefined,
        notes: dispatchNotes.trim() || undefined,
      });

      success(
        `Pacote ${res.shipment.shipmentCode} despachado com sucesso e arquivado no Histórico de Envios!${
          res.questClosureCreated ? ' 🏆 Fechamento da Quest registrado!' : ''
        }`
      );

      setIsDispatchModalOpen(false);

      // Recarrega os dados e muda para a aba de histórico exibindo o pacote
      await loadVaultData();
      setActiveTab('history');
      setExpandedShipmentIds(new Set([res.shipment.id]));

      if (onSuccess) onSuccess();
    } catch (err: any) {
      error(err.message || 'Erro ao despachar pacote.');
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const handleToggleShipmentStatus = async (
    shipmentId: string,
    currentStatus: ShipmentStatus
  ) => {
    const nextStatus: ShipmentStatus = currentStatus === 'ENVIADO' ? 'RECEBIDO' : 'ENVIADO';
    const actionLabel =
      nextStatus === 'RECEBIDO'
        ? 'Marcar este pacote como RECEBIDO/ENTREGUE? Isso atualizará o status de entrega de todas as cartas e produtos deste pacote.'
        : 'Reabrir este pacote como EM TRÂNSITO?';

    if (!window.confirm(actionLabel)) return;

    try {
      await customerVaultService.updateShipmentStatus(shipmentId, nextStatus);
      success(
        nextStatus === 'RECEBIDO'
          ? 'Pacote marcado como ENTREGUE/RECEBIDO com sucesso!'
          : 'Pacote reaberto como EM TRÂNSITO.'
      );
      if (customer) {
        setShipments(customerVaultService.getCustomerShipments(customer.id));
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar status do envio.');
    }
  };

  const handleCopyShipmentWhatsApp = async (shipment: CustomerShipmentPackage) => {
    const text = customerVaultService.formatShipmentWhatsAppNotification(shipment);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedShipmentId(shipment.id);
      setTimeout(() => setCopiedShipmentId(null), 2500);
      success(`Mensagem de envio de ${shipment.shipmentCode} copiada para o WhatsApp!`);
    } catch {
      error('Não foi possível copiar o texto.');
    }
  };

  const handleToggleExpandShipment = (shipmentId: string) => {
    setExpandedShipmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(shipmentId)) {
        next.delete(shipmentId);
      } else {
        next.add(shipmentId);
      }
      return next;
    });
  };

  if (!isOpen || !customer) return null;

  const stockUnits = stockItems.reduce((acc, i) => acc + (i.quantity || 1), 0);
  const totalItemsCount = auctionItems.length + stockUnits;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Gaveta de Envio & Carrinho Consolidado — ${customer.name}`}
      maxWidth="6xl"
    >
      <div className="space-y-5">
        {/* Card do Cliente & Informações de Contato / Envio */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 p-4 rounded-2xl bg-trigon-950 border border-trigon-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-crimson-950/80 border border-crimson-500/40 text-crimson-300 font-black flex items-center justify-center text-base shrink-0 shadow-md">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-base truncate">{customer.name}</span>
                <span className="font-mono text-xs text-trigon-400">
                  {formatPhoneMask(customer.phone)}
                </span>
                <a
                  href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-500/30 transition-colors"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>WhatsApp</span>
                </a>
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs text-trigon-400 truncate">
                {customer.street ? (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-crimson-400 shrink-0" />
                    <span>
                      {customer.street}, {customer.number || 'S/N'}
                      {customer.neighborhood ? ` • ${customer.neighborhood}` : ''}
                      {customer.city ? ` • ${customer.city}/${customer.state}` : ''}
                    </span>
                  </span>
                ) : (
                  <span className="text-amber-400/80 italic">Sem endereço cadastrado</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {customer.street && (
              <button
                type="button"
                onClick={handleCopyAddress}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-trigon-900 hover:bg-trigon-850 border border-trigon-750 text-xs font-semibold text-trigon-300 hover:text-white transition-all shadow-sm"
                title="Copiar etiqueta de envio para Correios/Transportadora"
              >
                {copiedAddress ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>Copiar Etiqueta</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/40 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-all shadow-sm"
              title="Copiar resumo completo do pacote para WhatsApp"
            >
              {copiedSummary ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Copiar Resumo WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs: Gaveta Atual vs Histórico de Envios */}
        <div className="flex items-center gap-2 border-b border-trigon-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'vault'
                ? 'bg-crimson-600 text-white shadow-md shadow-crimson-900/40'
                : 'bg-trigon-950 text-trigon-400 hover:text-white border border-trigon-800 hover:border-trigon-700'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Gaveta Atual</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'vault'
                  ? 'bg-crimson-800 text-white'
                  : 'bg-trigon-850 text-trigon-300'
              }`}
            >
              {totalItemsCount} un.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-crimson-600 text-white shadow-md shadow-crimson-900/40'
                : 'bg-trigon-950 text-trigon-400 hover:text-white border border-trigon-800 hover:border-trigon-700'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Histórico de Envios</span>
            {shipments.length > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  activeTab === 'history'
                    ? 'bg-crimson-800 text-white'
                    : 'bg-trigon-850 text-trigon-300'
                }`}
              >
                {shipments.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'vault' ? (
          <>
            {/* Barra de Progresso Gamificada da Quest Trigon (Mínimo R$ 100) */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            isQuestEligible
              ? 'bg-gradient-to-r from-emerald-950/40 via-trigon-950 to-amber-950/40 border-amber-500/50 shadow-md shadow-amber-950/20'
              : 'bg-trigon-950 border-trigon-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-xl border ${
                  isQuestEligible
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-trigon-900 border-trigon-750 text-trigon-400'
                }`}
              >
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <span className="font-cinzel text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <span>Programa Quest TRIGON</span>
                  <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.2 rounded">
                    Meta: {formatCurrency(QUEST_TARGET_DEFAULT)}
                  </span>
                </span>
                <p className="text-[11px] text-trigon-400">
                  {isQuestEligible ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Pacote apto para registrar conquista na Quest! Total: {formatCurrency(grandTotal)}
                    </span>
                  ) : (
                    <span>
                      Faltam apenas{' '}
                      <strong className="text-amber-300 font-mono">
                        {formatCurrency(missingForQuest)}
                      </strong>{' '}
                      em produtos para atingir os {formatCurrency(QUEST_TARGET_DEFAULT)} e liberar sua peça na Quest.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="font-mono text-sm font-black text-white">
                {formatCurrency(grandTotal)}{' '}
                <span className="text-xs text-trigon-500 font-normal">
                  / {formatCurrency(QUEST_TARGET_DEFAULT)}
                </span>
              </span>
              <span
                className={`text-[10px] block font-bold font-mono ${
                  isQuestEligible ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {questProgressPct}% Concluído
              </span>
            </div>
          </div>

          {/* Barra Visual de Progresso */}
          <div className="w-full h-2.5 bg-trigon-900 rounded-full overflow-hidden border border-trigon-800">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isQuestEligible
                  ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-300 shadow-glow-amber'
                  : 'bg-gradient-to-r from-crimson-600 to-amber-500'
              }`}
              style={{ width: `${questProgressPct}%` }}
            />
          </div>
        </div>

        {/* Seção 1: Cartas Pagas do Leilão Guardadas na Gaveta */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-cinzel text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Gavel className="w-4 h-4 text-emerald-400" />
              <span>Cartas Arrematadas em Leilões (Pagas) ({auctionItems.length})</span>
            </h3>
            <span className="font-mono text-xs font-bold text-emerald-400">
              Subtotal: {formatCurrency(subtotalAuction)}
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-trigon-500 font-mono">
              Carregando arremates pagos do cliente...
            </div>
          ) : auctionItems.length === 0 ? (
            <div className="p-6 rounded-2xl bg-trigon-950/60 border border-trigon-800 text-center space-y-1">
              <p className="text-xs text-trigon-400">
                Nenhuma carta arrematada com status <strong>PAGO</strong> aguardando envio para este cliente.
              </p>
              <p className="text-[11px] text-trigon-500">
                (Apenas cartas pagas com envio não solicitado ou solicitado aparecem aqui. Cartas já enviadas ou recebidas saem automaticamente da gaveta).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {auctionItems.map((item) => {
                const activePhoto = item.customPhotoUrl || item.apiImageUrl;
                const isSolicitado = item.shippingStatus === 'SOLICITADO';
                const finalVal = item.isFreebie ? 0 : Number(item.finalPrice || item.initialPrice || 0);

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-trigon-950 border border-trigon-800 flex items-center justify-between gap-3 hover:border-trigon-700 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-16 rounded-xl bg-trigon-900 border border-trigon-750 flex items-center justify-center overflow-hidden shrink-0">
                        {activePhoto ? (
                          <img
                            src={activePhoto}
                            alt={item.title}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Layers className="w-5 h-5 text-trigon-600" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-xs truncate">{item.title}</h4>
                          {item.auction?.code && (
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-crimson-950/80 border border-crimson-500/30 text-crimson-300 font-semibold">
                              Leilão #{item.auction.code}
                            </span>
                          )}
                          {item.isFreebie && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 border border-purple-500/40 text-purple-300 font-bold">
                              🎁 BRINDE
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-trigon-400 mt-0.5 flex-wrap">
                          {item.subtitle && <span>{cleanSetName(item.subtitle)}</span>}
                          {item.condition && (
                            <span className="font-semibold text-trigon-200">{item.condition}</span>
                          )}
                          {item.language && <span>{item.language}</span>}
                          {item.finish && item.finish !== 'NORMAL' && (
                            <span className="text-amber-300">✨ {item.finish}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-sm font-bold text-emerald-400">
                        {item.isFreebie ? 'R$ 0,00' : formatCurrency(finalVal)}
                      </span>

                      {/* Botão de Solicitação de Envio */}
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleShippingStatus(item.id, false, item.shippingStatus)
                        }
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                          isSolicitado
                            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                            : 'bg-trigon-900 border-trigon-750 text-trigon-400 hover:text-white'
                        }`}
                        title="Clique para alternar se este item deve ser despachado agora ou mantido na gaveta"
                      >
                        {isSolicitado ? '✓ Envio Solicitado' : 'Guardado na Gaveta'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Seção 2: Itens Adicionados do Estoque */}
        <div className="space-y-3 pt-3 border-t border-trigon-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-cinzel text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Produtos & Cartas do Estoque (Pagos) ({stockItems.length})</span>
              </h3>
              <span className="font-mono text-xs font-bold text-purple-300">
                Subtotal: {formatCurrency(subtotalStock)}
              </span>
            </div>

            <Button
              type="button"
              variant={isAddingStockOpen ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setIsAddingStockOpen(!isAddingStockOpen)}
              icon={isAddingStockOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            >
              {isAddingStockOpen ? 'Fechar Busca' : '+ Adicionar Carta do Estoque'}
            </Button>
          </div>

          {/* Painel Inline de Busca no Estoque */}
          {isAddingStockOpen && (
            <div className="p-4 rounded-2xl bg-trigon-950 border border-crimson-500/40 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-crimson-400" />
                  <span>Buscar Carta ou Produto no Estoque Geral</span>
                </span>
                <span className="text-[10px] text-trigon-400 font-mono">
                  Mostrando estoque disponível
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-trigon-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={stockSearchTerm}
                  onChange={(e) => setStockSearchTerm(e.target.value)}
                  placeholder="Pesquise por nome da carta, número (ex: 047) ou coleção..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {filteredStock.length === 0 ? (
                  <p className="text-xs text-trigon-500 py-3 text-center">
                    Nenhuma carta com saldo disponível encontrada.
                  </p>
                ) : (
                  filteredStock.map((v) => {
                    const isSelected = addingVariantId === v.id;
                    const cardName = v.card?.name || 'Carta TCG';
                    const num = v.card?.localId ? `#${v.card.localId}` : '';
                    const setInfo = v.card?.setName ? cleanSetName(v.card.setName) : '';
                    const refPrice = v.salePrice || v.referenceValue || 10;

                    return (
                      <div
                        key={v.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                          isSelected
                            ? 'bg-crimson-950/40 border-crimson-500'
                            : 'bg-trigon-900/60 border-trigon-800 hover:border-trigon-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-9 h-12 rounded-lg bg-black/60 border border-trigon-750 flex items-center justify-center overflow-hidden shrink-0">
                            {v.card?.imageUrl ? (
                              <img
                                src={v.card.imageUrl}
                                alt={cardName}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Layers className="w-4 h-4 text-trigon-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-xs truncate">
                              {cardName} {num}
                            </p>
                            <p className="text-[10px] text-trigon-400 truncate">
                              {setInfo} • Saldo: <strong className="text-white">{v.quantity} un.</strong>
                              {v.condition && ` • ${v.condition}`}
                            </p>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-trigon-400 font-mono">R$</span>
                              <input
                                type="number"
                                step="0.50"
                                min="0"
                                value={customPriceInput}
                                onChange={(e) => setCustomPriceInput(e.target.value)}
                                className="w-20 px-2 py-1 rounded-lg bg-trigon-950 border border-crimson-500 text-white text-xs font-mono font-bold focus:outline-none"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => handleConfirmAddStock(v)}
                            >
                              Confirmar
                            </Button>
                            <button
                              type="button"
                              onClick={() => setAddingVariantId(null)}
                              className="p-1 text-trigon-500 hover:text-white"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="font-mono text-xs font-bold text-trigon-200">
                              {formatCurrency(refPrice)}
                            </span>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleStartAddStock(v)}
                            >
                              + Adicionar
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Listagem de itens de estoque que já estão na gaveta */}
          {stockItems.length === 0 ? (
            <p className="text-xs text-trigon-500 italic py-2">
              Nenhum produto avulso adicionado do estoque à gaveta ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {stockItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-trigon-950 border border-trigon-800 flex items-center justify-between gap-3 hover:border-trigon-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-16 rounded-xl bg-trigon-900 border border-trigon-750 flex items-center justify-center overflow-hidden shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Layers className="w-5 h-5 text-purple-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-white text-xs truncate">{item.name}</h4>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 border border-purple-500/30 text-purple-300 font-semibold">
                          {item.productId ? 'Catálogo' : 'Carta TCG'}
                        </span>
                        {item.quantity && item.quantity > 1 ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-trigon-800 border border-trigon-700 text-trigon-200 font-bold font-mono">
                            {item.quantity} un.
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-trigon-400 mt-0.5 flex-wrap">
                        {item.subtitle && <span>{item.subtitle}</span>}
                        {item.condition && (
                          <span className="font-semibold text-trigon-200">{item.condition}</span>
                        )}
                        {item.finish && item.finish !== 'NORMAL' && (
                          <span className="text-amber-300">✨ {item.finish}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-purple-300 block">
                        {formatCurrency(Number(item.unitPrice || 0) * (item.quantity || 1))}
                      </span>
                      {item.quantity && item.quantity > 1 ? (
                        <span className="font-mono text-[10px] text-trigon-400 block">
                          {item.quantity}x {formatCurrency(item.unitPrice)}
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleToggleShippingStatus(item.id, true, item.shippingStatus)
                      }
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                        item.shippingStatus === 'SOLICITADO'
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                          : 'bg-trigon-900 border-trigon-750 text-trigon-400 hover:text-white'
                      }`}
                    >
                      {item.shippingStatus === 'SOLICITADO' ? '✓ Envio Solicitado' : 'Guardado'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveStockItem(item)}
                      title={`Remover e devolver ${item.quantity || 1} un. ao estoque`}
                      className="p-2 rounded-xl text-trigon-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé Consolidado & Despacho do Pacote */}
        <div className="p-4 rounded-2xl bg-trigon-950 border border-trigon-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase font-bold text-trigon-400 block tracking-wider">
                Resumo Consolidado do Pacote ({totalItemsCount} itens)
              </span>
              <p className="text-[11px] text-trigon-500 mt-0.5">
                Leilão: {formatCurrency(subtotalAuction)} + Produtos da Loja: {formatCurrency(subtotalStock)}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-trigon-400 uppercase font-semibold block">Total Geral</span>
              <span className="font-mono text-2xl font-black text-emerald-400">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          {/* Opção da Quest Trigon ao despachar */}
          {isQuestEligible && (
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400 shrink-0" />
                <label
                  htmlFor="registerQuestClosure"
                  className="text-xs text-amber-200 font-medium cursor-pointer"
                >
                  Registrar automaticamente fechamento de <strong>{formatCurrency(grandTotal)}</strong> na Quest TRIGON do cliente
                </label>
              </div>
              <input
                type="checkbox"
                id="registerQuestClosure"
                checked={registerQuestOnDispatch}
                onChange={(e) => setRegisterQuestOnDispatch(e.target.checked)}
                className="w-4 h-4 rounded border-trigon-700 bg-trigon-900 text-amber-500 focus:ring-amber-500"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 border-t border-trigon-800/80">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar Gaveta
            </Button>

            <Button
              type="button"
              variant="primary"
              disabled={totalItemsCount === 0}
              loading={submittingDispatch}
              onClick={handleOpenDispatchModal}
              icon={<Truck className="w-4 h-4" />}
            >
              Despachar Pacote ({totalItemsCount} un. como Enviado)
            </Button>
          </div>
        </div>
      </>
    ) : (
      /* Histórico de Envios & Pacotes Despachados */
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-bold text-trigon-400 tracking-wider">
            Pacotes Despachados ({shipments.length})
          </span>
          <span className="text-[11px] text-trigon-500">
            Clique na seta para ver as cartas e itens de cada pacote
          </span>
        </div>

        {shipments.length === 0 ? (
          <div className="p-10 rounded-2xl bg-trigon-950/60 border border-trigon-800 text-center space-y-2">
            <Truck className="w-10 h-10 text-trigon-600 mx-auto" />
            <h4 className="text-sm font-bold text-white">Nenhum envio registrado ainda</h4>
            <p className="text-xs text-trigon-400 max-w-md mx-auto leading-relaxed">
              Quando você despachar a gaveta atual deste cliente, o pacote ficará arquivado aqui com código único, código de rastreio, lista completa dos itens e status de entrega.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shipments.map((shp) => {
              const isExpanded = expandedShipmentIds.has(shp.id);
              const isReceived = shp.status === 'RECEBIDO';
              const trackingUrl = customerVaultService.getTrackingUrl(shp.carrier, shp.trackingCode);
              const carrierLabel = customerVaultService.getCarrierLabel(shp.carrier, shp.customCarrierName);
              const dateFormatted = new Date(shp.dispatchedAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={shp.id}
                  className={`rounded-2xl border transition-all ${
                    isReceived
                      ? 'bg-trigon-950/80 border-emerald-900/40 shadow-sm'
                      : 'bg-trigon-950 border-trigon-800 hover:border-trigon-700 shadow-md'
                  }`}
                >
                  {/* Cabeçalho do Pacote */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                          isReceived
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                            : 'bg-amber-950/40 border-amber-500/30 text-amber-400'
                        }`}
                      >
                        <Truck className="w-5 h-5" />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-white px-2 py-0.5 rounded bg-trigon-850 border border-trigon-750">
                            {shp.shipmentCode}
                          </span>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isReceived
                                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                                : 'bg-amber-950/80 border-amber-500/40 text-amber-300 animate-pulse'
                            }`}
                          >
                            {isReceived ? '✓ ENTREGUE / RECEBIDO' : '🚚 EM TRÂNSITO'}
                          </span>

                          {shp.isQuestClosure && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                              <Compass className="w-3 h-3 text-amber-400" />
                              Quest Fechada
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-trigon-400 flex-wrap">
                          <span>📅 {dateFormatted}</span>
                          <span>•</span>
                          <span>🚚 {carrierLabel}</span>
                          <span>•</span>
                          <span className="font-mono font-bold text-trigon-200">
                            {shp.totalItemsCount} item(ns)
                          </span>
                          <span>•</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {formatCurrency(shp.totalValue)}
                          </span>
                        </div>

                        {shp.trackingCode ? (
                          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                            <span className="text-[11px] text-trigon-300 font-mono">
                              Rastreio:{' '}
                              <strong className="text-white select-all bg-trigon-900 px-1.5 py-0.2 rounded border border-trigon-800">
                                {shp.trackingCode}
                              </strong>
                            </span>
                            {trackingUrl && (
                              <a
                                href={trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-crimson-400 hover:text-crimson-300 flex items-center gap-1 font-semibold"
                              >
                                <span>Rastrear</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-trigon-500 italic">
                            Sem código de rastreio cadastrado
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Ações Rápidas do Pacote */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopyShipmentWhatsApp(shp)}
                        icon={
                          copiedShipmentId === shp.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                          )
                        }
                      >
                        {copiedShipmentId === shp.id ? 'Copiado!' : 'Aviso WhatsApp'}
                      </Button>

                      <Button
                        type="button"
                        variant={isReceived ? 'ghost' : 'secondary'}
                        size="sm"
                        onClick={() => handleToggleShipmentStatus(shp.id, shp.status)}
                        className={
                          isReceived
                            ? 'text-trigon-400 hover:text-white'
                            : 'text-emerald-400 border-emerald-500/40 hover:bg-emerald-950/40'
                        }
                      >
                        {isReceived ? 'Reabrir Trânsito' : 'Marcar como Recebido'}
                      </Button>

                      <button
                        type="button"
                        onClick={() => handleToggleExpandShipment(shp.id)}
                        className="p-2 rounded-xl text-trigon-400 hover:text-white hover:bg-trigon-800 transition-colors"
                        title={isExpanded ? 'Recolher detalhes' : 'Ver itens do pacote'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Detalhes Expandidos: Snapshot dos Itens do Pacote */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-trigon-800/80 space-y-2.5">
                      <span className="text-[11px] font-bold uppercase text-trigon-400 tracking-wider block">
                        Itens Enviados neste Pacote ({shp.items.length}):
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {shp.items.map((it, idx) => (
                          <div
                            key={`${it.id}_${idx}`}
                            className="p-2.5 rounded-xl bg-trigon-900/60 border border-trigon-800 flex items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-12 rounded-lg bg-trigon-950 border border-trigon-750 flex items-center justify-center overflow-hidden shrink-0">
                                {it.imageUrl ? (
                                  <img
                                    src={it.imageUrl}
                                    alt={it.name}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <Layers className="w-4 h-4 text-trigon-600" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-white truncate max-w-[150px]">
                                    {it.name}
                                  </span>
                                  {it.sourceType === 'AUCTION' && it.auctionCode && (
                                    <span className="text-[9px] px-1 rounded bg-crimson-950 text-crimson-300 font-mono">
                                      #{it.auctionCode}
                                    </span>
                                  )}
                                  {it.quantity > 1 && (
                                    <span className="text-[9px] px-1 rounded bg-trigon-800 text-trigon-200 font-bold font-mono">
                                      {it.quantity}x
                                    </span>
                                  )}
                                  {it.isFreebie && (
                                    <span className="text-[9px] px-1 rounded bg-purple-950 text-purple-300 font-bold">
                                      BRINDE
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 text-[10px] text-trigon-400 mt-0.5">
                                  {it.condition && <span>{it.condition}</span>}
                                  {it.finish && it.finish !== 'NORMAL' && (
                                    <span className="text-amber-300">✨ {it.finish}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-mono text-xs font-bold text-emerald-400">
                                {it.isFreebie ? 'R$ 0,00' : formatCurrency(it.totalPrice)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {shp.customerAddress && (
                        <p className="text-[11px] text-trigon-400 pt-1">
                          📍 <strong>Destino:</strong> {shp.customerAddress}
                        </p>
                      )}
                      {shp.notes && (
                        <p className="text-[11px] text-trigon-400 italic">
                          📝 <strong>Observações:</strong> {shp.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end pt-3 border-t border-trigon-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    )}
  </div>

  {/* Modal de Confirmação de Expedição & Despacho */}
  <Modal
    isOpen={isDispatchModalOpen}
    onClose={() => setIsDispatchModalOpen(false)}
    title="Confirmar Expedição & Despacho do Pacote"
    description={`Envio consolidado de ${totalItemsCount} item(ns) para ${customer.name}`}
    maxWidth="lg"
  >
    <form onSubmit={handleConfirmDispatch} className="space-y-4">
      {/* Resumo do Destinatário & Valores */}
      <div className="p-3.5 rounded-xl bg-trigon-950 border border-trigon-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-trigon-400">Destinatário:</span>
          <span className="font-bold text-white">{customer.name}</span>
        </div>
        {customer.phone && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-trigon-400">Telefone:</span>
            <span className="font-mono text-trigon-200">{formatPhoneMask(customer.phone)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
          <span className="text-trigon-400">Endereço de Entrega:</span>
          <span className="text-right text-trigon-200 truncate max-w-[280px]">
            {customer.street
              ? `${customer.street}, ${customer.number || 'S/N'}${
                  customer.city ? ` • ${customer.city}/${customer.state}` : ''
                }`
              : 'Retirada / A combinar'}
          </span>
        </div>
        <div className="pt-2 border-t border-trigon-800/80 flex items-center justify-between">
          <span className="text-xs font-bold text-trigon-300">
            Total Consolidado ({totalItemsCount} un.):
          </span>
          <span className="font-mono text-base font-black text-emerald-400">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>

      {/* Transportadora e Rastreio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
            Transportadora / Frete *
          </label>
          <select
            value={dispatchCarrier}
            onChange={(e) => setDispatchCarrier(e.target.value as ShipmentCarrier)}
            className="w-full h-10 px-3 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
          >
            <option value="CORREIOS_MINI">Correios (Mini Envios)</option>
            <option value="CORREIOS_PAC">Correios (PAC)</option>
            <option value="CORREIOS_SEDEX">Correios (Sedex)</option>
            <option value="JADLOG">Jadlog</option>
            <option value="MELHOR_ENVIO">Melhor Envio</option>
            <option value="BALCAO">Retirada no Balcão</option>
            <option value="OUTRO">Outra Transportadora</option>
          </select>
        </div>

        {dispatchCarrier === 'OUTRO' ? (
          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
              Nome da Transportadora *
            </label>
            <input
              type="text"
              placeholder="Ex: Loggi, Motoboy..."
              value={dispatchCustomCarrier}
              onChange={(e) => setDispatchCustomCarrier(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
              required
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
              Código de Rastreio (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: QB123456789BR"
              value={dispatchTrackingCode}
              onChange={(e) => setDispatchTrackingCode(e.target.value.toUpperCase())}
              className="w-full h-10 px-3 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs font-mono uppercase focus:outline-none focus:border-crimson-500 placeholder-trigon-600"
            />
          </div>
        )}
      </div>

      {dispatchCarrier === 'OUTRO' && (
        <div>
          <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
            Código de Rastreio (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Rastreio ou link..."
            value={dispatchTrackingCode}
            onChange={(e) => setDispatchTrackingCode(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs font-mono focus:outline-none focus:border-crimson-500 placeholder-trigon-600"
          />
        </div>
      )}

      {/* Frete e Observações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
            Valor do Frete (R$, Opcional)
          </label>
          <input
            type="text"
            placeholder="0,00"
            value={dispatchShippingCost}
            onChange={(e) => setDispatchShippingCost(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs font-mono focus:outline-none focus:border-crimson-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
            Observações do Envio (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Caixa reforçada, brinde..."
            value={dispatchNotes}
            onChange={(e) => setDispatchNotes(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
          />
        </div>
      </div>

      {/* Quest Trigon */}
      {isQuestEligible && (
        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-2.5">
          <input
            type="checkbox"
            id="modalRegisterQuest"
            checked={registerQuestOnDispatch}
            onChange={(e) => setRegisterQuestOnDispatch(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-trigon-700 bg-trigon-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
          />
          <label htmlFor="modalRegisterQuest" className="text-xs text-amber-200 cursor-pointer select-none">
            <span className="font-bold flex items-center gap-1.5 text-white">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              Registrar Fechamento na Quest Trigon
            </span>
            <span className="text-[11px] text-amber-300/80 block mt-0.5">
              Este pacote atingiu {formatCurrency(grandTotal)} (meta de R$ 100,00) e liberará o avanço de peça na Quest do cliente!
            </span>
          </label>
        </div>
      )}

      {/* Ações do Modal de Expedição */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-trigon-800">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsDispatchModalOpen(false)}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={submittingDispatch}
          icon={<Truck className="w-4 h-4" />}
        >
          Confirmar Despacho & Salvar no Histórico
        </Button>
      </div>
    </form>
  </Modal>
</Modal>
  );
};
