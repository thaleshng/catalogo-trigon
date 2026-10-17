import React, { useState, useEffect } from 'react';
import { Customer, Gift, CustomerGift, GiftStatus } from '../../types';
import { giftService } from '../../services/giftService';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { formatDateTime, getSaoPauloDateTimeLocal, parseSaoPauloDateTime } from '../../utils/formatters';
import {
  Gift as GiftIcon,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Trash2,
  Calendar,
  FileText,
  Loader2,
  RotateCcw,
} from 'lucide-react';

interface CustomerGiftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

export const CustomerGiftsModal: React.FC<CustomerGiftsModalProps> = ({
  isOpen,
  onClose,
  customer,
}) => {
  const [history, setHistory] = useState<CustomerGift[]>([]);
  const [availableGifts, setAvailableGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);

  // New Link Form State
  const [selectedGiftId, setSelectedGiftId] = useState('');
  const [status, setStatus] = useState<GiftStatus>('reservado');
  const [giftedAt, setGiftedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Duplicate Warning State
  const [duplicateWarning, setDuplicateWarning] = useState<CustomerGift[] | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  // Edit / Status Update State
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<CustomerGift | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { success, error, info } = useToast();

  const loadData = async () => {
    if (!customer) return;
    try {
      setLoading(true);
      const [giftsHistory, enabledGifts] = await Promise.all([
        giftService.getCustomerGifts(customer.id),
        giftService.getGifts({ availableOnly: true }),
      ]);
      setHistory(giftsHistory);
      setAvailableGifts(enabledGifts);
    } catch (err: any) {
      console.error(err);
      error('Não foi possível carregar os brindes deste cliente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customer) {
      loadData();
      resetForm();
    }
  }, [isOpen, customer]);

  const resetForm = () => {
    setSelectedGiftId('');
    setStatus('reservado');
    setGiftedAt(getSaoPauloDateTimeLocal());
    setNotes('');
    setDuplicateWarning(null);
    setDuplicateConfirmed(false);
  };

  // Efeito ao selecionar um brinde no dropdown: verifica histórico de duplicidade
  const handleGiftSelectionChange = (giftId: string) => {
    setSelectedGiftId(giftId);
    setDuplicateConfirmed(false);

    if (!giftId) {
      setDuplicateWarning(null);
      return;
    }

    // Consulta ocorrências prévias no histórico atual do cliente
    const existingMatches = history.filter((item) => item.giftId === giftId);
    if (existingMatches.length > 0) {
      setDuplicateWarning(existingMatches);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleLinkGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !selectedGiftId) {
      info('Selecione um brinde para vincular.');
      return;
    }

    // Se houver duplicidade e o usuário ainda não confirmou expressamente
    if (duplicateWarning && duplicateWarning.length > 0 && !duplicateConfirmed) {
      info('Atenção: confirme o vínculo repetido clicando em "Vincular mesmo assim".');
      return;
    }

    try {
      setIsSubmitting(true);
      const formattedDate =
        status === 'enviado'
          ? parseSaoPauloDateTime(giftedAt)
          : null;

      await giftService.linkGiftToCustomer({
        customerId: customer.id,
        giftId: selectedGiftId,
        status,
        giftedAt: formattedDate,
        notes,
      });

      success('Brinde vinculado ao cliente com sucesso!');
      resetForm();
      await loadData();
    } catch (err: any) {
      console.error(err);
      error(err.message || 'Erro ao vincular brinde.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: CustomerGift) => {
    const newStatus: GiftStatus = item.status === 'reservado' ? 'enviado' : 'reservado';
    try {
      setUpdatingId(item.id);
      await giftService.updateCustomerGift(item.id, {
        status: newStatus,
        giftedAt: newStatus === 'enviado' ? new Date().toISOString() : null,
      });
      success(`Situação atualizada para "${newStatus === 'enviado' ? 'Enviado' : 'Reservado'}".`);
      await loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar situação.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRequestDelete = (item: CustomerGift) => {
    setDeleteTarget(item);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await giftService.removeCustomerGift(deleteTarget.id);
      success('Vínculo de brinde removido do histórico.');
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao remover vínculo.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Brindes do Cliente"
        description={
          customer
            ? `Gerencie e acompanhe os agrados para ${customer.name} (${customer.phone})`
            : undefined
        }
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {/* SESSÃO 1: FORMULÁRIO DE NOVO VÍNCULO */}
          <div className="bg-trigon-950/80 border border-trigon-750 rounded-2xl p-4 sm:p-5 shadow-inner">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-trigon-800">
              <GiftIcon className="w-5 h-5 text-crimson-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Vincular Novo Brinde
              </h4>
            </div>

            <form onSubmit={handleLinkGift} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Seleção do Brinde */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-semibold text-trigon-300">
                    Selecione o Brinde <span className="text-crimson-400">*</span>
                  </label>
                  <select
                    value={selectedGiftId}
                    onChange={(e) => handleGiftSelectionChange(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                  >
                    <option value="">-- Escolha um brinde disponível --</option>
                    {availableGifts.map((gift) => (
                      <option key={gift.id} value={gift.id}>
                        {gift.name} {gift.description ? `(${gift.description.slice(0, 40)}...)` : ''}
                      </option>
                    ))}
                  </select>
                  {availableGifts.length === 0 && !loading && (
                    <p className="text-[11px] text-amber-400/90 pt-1">
                      Nenhum brinde está habilitado no momento. Cadastre ou ative brindes na página de Brindes.
                    </p>
                  )}
                </div>

                {/* Situação: Reservado ou Enviado */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-trigon-300">
                    Situação <span className="text-crimson-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus('reservado')}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        status === 'reservado'
                          ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-sm'
                          : 'bg-trigon-900 border-trigon-800 text-trigon-400 hover:text-white'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Reservado</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatus('enviado')}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        status === 'enviado'
                          ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-sm'
                          : 'bg-trigon-900 border-trigon-800 text-trigon-400 hover:text-white'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviado</span>
                    </button>
                  </div>
                </div>

                {/* Data Efetiva de Envio (se status for enviado) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-trigon-300">
                    Data do Envio
                  </label>
                  <input
                    type="datetime-local"
                    value={giftedAt}
                    onChange={(e) => setGiftedAt(e.target.value)}
                    disabled={status !== 'enviado'}
                    className={`w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none transition-all ${
                      status === 'enviado'
                        ? 'bg-trigon-900 border-trigon-750 text-white focus:border-crimson-500'
                        : 'bg-trigon-950/50 border-trigon-850 text-trigon-600 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>

              {/* Observação Opcional */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-trigon-300">
                  Observações (opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Enviado no pacote do Charizard SAR, Brinde de Aniversário..."
                  className="w-full px-3.5 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 placeholder-trigon-600"
                />
              </div>

              {/* ALERTA DE BRINDE REPETIDO */}
              {duplicateWarning && duplicateWarning.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-950/50 border border-amber-500/50 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-bold text-amber-300">
                        Atenção! Este cliente já possui um registro deste brinde.
                      </h5>
                      <p className="text-xs text-amber-200/80 mt-1">
                        Histórico anterior deste brinde para este cliente:
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {duplicateWarning.map((prevItem) => (
                          <li
                            key={prevItem.id}
                            className="text-xs text-amber-100 flex items-center gap-2 bg-amber-900/40 px-2.5 py-1 rounded-lg border border-amber-700/40"
                          >
                            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>
                              Data: <strong>{formatDateTime(prevItem.createdAt)}</strong>
                            </span>
                            <span className="text-amber-400/60">•</span>
                            <span>
                              Situação:{' '}
                              <strong className="uppercase">
                                {prevItem.status === 'enviado' ? 'Enviado' : 'Reservado'}
                              </strong>
                            </span>
                            {prevItem.notes && (
                              <span className="text-amber-200/70 truncate">
                                ({prevItem.notes})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-500/20">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedGiftId('');
                        setDuplicateWarning(null);
                        setDuplicateConfirmed(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setDuplicateConfirmed(true)}
                    >
                      {duplicateConfirmed ? 'Vínculo Confirmado ✓' : 'Vincular mesmo assim'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Botão de Submissão */}
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  disabled={
                    !selectedGiftId ||
                    (duplicateWarning !== null && duplicateWarning.length > 0 && !duplicateConfirmed)
                  }
                  icon={<Plus className="w-4 h-4" />}
                >
                  Vincular Brinde ao Cliente
                </Button>
              </div>
            </form>
          </div>

          {/* SESSÃO 2: HISTÓRICO DE BRINDES DO CLIENTE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Histórico de Brindes</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-trigon-800 text-trigon-300 font-mono">
                  {history.length}
                </span>
              </h4>
            </div>

            {loading ? (
              <div className="p-8 text-center text-trigon-400 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-crimson-500" />
                <span>Carregando histórico...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center bg-trigon-950/40 rounded-2xl border border-trigon-800 space-y-2">
                <GiftIcon className="w-8 h-8 text-trigon-600 mx-auto" />
                <p className="text-xs sm:text-sm text-trigon-400">
                  Nenhum brinde foi vinculado a este cliente até o momento.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-trigon-950 border border-trigon-800 hover:border-trigon-700 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Thumbnail do Brinde */}
                      <div className="w-12 h-12 rounded-xl bg-trigon-900 border border-trigon-750 flex items-center justify-center overflow-hidden shrink-0">
                        {item.gift?.imageUrl ? (
                          <img
                            src={item.gift.imageUrl}
                            alt={item.gift.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <GiftIcon className="w-5 h-5 text-crimson-400" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white truncate">
                            {item.gift?.name || 'Brinde'}
                          </span>
                          <Badge
                            variant={item.status === 'enviado' ? 'success' : 'warning'}
                            dot
                          >
                            {item.status === 'enviado' ? 'Enviado' : 'Reservado'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-trigon-400 flex-wrap">
                          <span>Registrado em: {formatDateTime(item.createdAt)}</span>
                          {item.giftedAt && (
                            <span className="text-emerald-400/90">
                              Enviado em: {formatDateTime(item.giftedAt)}
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-[11px] text-trigon-300 italic flex items-center gap-1">
                            <FileText className="w-3 h-3 text-trigon-500 shrink-0" />
                            <span className="truncate">{item.notes}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Ações para o item do histórico */}
                    <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-trigon-850">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        disabled={updatingId === item.id}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          item.status === 'reservado'
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/50'
                            : 'bg-amber-950/40 text-amber-300 border-amber-700/50 hover:bg-amber-900/50'
                        }`}
                        title={
                          item.status === 'reservado'
                            ? 'Marcar como Enviado'
                            : 'Retornar para Reservado'
                        }
                      >
                        {updatingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : item.status === 'reservado' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Marcar Enviado</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                            <span>Para Reservado</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRequestDelete(item)}
                        className="p-1.5 rounded-lg border border-crimson-900/40 text-crimson-400 hover:text-crimson-300 hover:bg-crimson-950/40 transition-colors"
                        title="Remover este vínculo incorreto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Confirmação de exclusão de vínculo */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Remover Registro de Brinde"
        message={`Deseja realmente excluir o registro do brinde "${deleteTarget?.gift?.name || 'selecionado'}" do histórico de ${customer?.name}? Esta ação não poderá ser desfeita.`}
        confirmText="Excluir Vínculo"
        loading={isDeleting}
      />
    </>
  );
};
