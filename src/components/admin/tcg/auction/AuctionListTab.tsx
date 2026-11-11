import React, { useState, useMemo } from 'react';
import { TcgAuction } from '../../../../types';
import {
  formatCurrency,
  formatAuctionPeriod,
  parseDateInputToIso,
  getSaoPauloDateTimeLocal,
  addDaysToDateTimeLocal,
} from '../../../../utils/formatters';
import { Modal } from '../../../../components/common/Modal';
import { Button } from '../../../../components/common/Button';
import { useToast } from '../../../../components/common/Toast';
import { auctionService } from '../../../../services/auctionService';
import { Pagination } from '../../../../components/common/Pagination';
import {
  Gavel,
  Plus,
  History,
  Calendar,
  ArrowRight,
  Edit3,
  Clock,
  Sparkles,
  Package,
  CheckCircle2,
  Coins,
  Tag,
  TrendingUp,
} from 'lucide-react';

interface AuctionListTabProps {
  auctions: TcgAuction[];
  onSelectAuction: (auctionId: string) => void;
  onRefresh: () => void;
}

export const AuctionListTab: React.FC<AuctionListTabProps> = ({
  auctions,
  onSelectAuction,
  onRefresh,
}) => {
  const { success, error } = useToast();

  // Modais de Criação
  const [isNewPreAuctionOpen, setIsNewPreAuctionOpen] = useState(false);
  const [isPastAuctionOpen, setIsPastAuctionOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Formulário de Novo Pré-Leilão
  const nextSuggestedNum =
    auctions.length > 0
      ? Math.max(...auctions.map((a) => parseInt(a.code.replace(/\D/g, ''), 10) || 0)) + 1
      : 9;

  const [preAuctionCode, setPreAuctionCode] = useState(
    auctionService.formatAuctionCode(nextSuggestedNum)
  );
  const [preAuctionTitle, setPreAuctionTitle] = useState('');
  const [preStartDate, setPreStartDate] = useState(() => {
    const sp = getSaoPauloDateTimeLocal();
    const [dPart, tPart] = sp.split('T');
    return `${dPart}T${tPart.slice(0, 2)}:00`;
  });
  const [preEndDate, setPreEndDate] = useState(() => {
    const sp = getSaoPauloDateTimeLocal();
    const [dPart, tPart] = sp.split('T');
    const startStr = `${dPart}T${tPart.slice(0, 2)}:00`;
    return addDaysToDateTimeLocal(startStr, 1);
  });
  const [prePaymentDeadlineHours, setPrePaymentDeadlineHours] = useState(48);
  const [preNotes, setPreNotes] = useState('');

  // Formulário de Leilão Passado
  const [pastAuctionCode, setPastAuctionCode] = useState('001');
  const [pastAuctionTitle, setPastAuctionTitle] = useState('');
  const [pastStartDate, setPastStartDate] = useState('');
  const [pastEndDate, setPastEndDate] = useState('');
  const [pastNotes, setPastNotes] = useState('');

  // Paginação da listagem de leilões (padrão: 3 leilões mais recentes por página)
  const [currentPage, setCurrentPage] = useState(1);
  const [auctionsPerPage, setAuctionsPerPage] = useState(3);

  const totalPages = Math.max(1, Math.ceil(auctions.length / auctionsPerPage));
  const paginatedAuctions = useMemo(() => {
    const start = (currentPage - 1) * auctionsPerPage;
    return auctions.slice(start, start + auctionsPerPage);
  }, [auctions, currentPage, auctionsPerPage]);

  const handleCreatePreAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await auctionService.createAuction({
        code: preAuctionCode,
        title: preAuctionTitle.trim() || null,
        startDate: parseDateInputToIso(preStartDate),
        endDate: parseDateInputToIso(preEndDate),
        paymentDeadlineHours: prePaymentDeadlineHours,
        notes: preNotes.trim() || null,
      });
      success(`Pré-Leilão #${preAuctionCode.padStart(3, '0')} criado com sucesso!`);
      setIsNewPreAuctionOpen(false);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Erro ao criar pré-leilão.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterPastAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await auctionService.registerPastAuction({
        code: pastAuctionCode,
        title: pastAuctionTitle.trim() || null,
        startDate: parseDateInputToIso(pastStartDate),
        endDate: parseDateInputToIso(pastEndDate),
        notes: pastNotes.trim() || null,
      });
      success(`Leilão Histórico #${pastAuctionCode.padStart(3, '0')} registrado com sucesso!`);
      setIsPastAuctionOpen(false);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Erro ao registrar leilão passado.');
    } finally {
      setSubmitting(false);
    }
  };

  // Estados do Modal de Edição de Leilão
  const [isEditAuctionOpen, setIsEditAuctionOpen] = useState(false);
  const [editingAuction, setEditingAuction] = useState<TcgAuction | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editPaymentDeadlineHours, setEditPaymentDeadlineHours] = useState(48);
  const [editNotes, setEditNotes] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const handleOpenEditAuction = (auc: TcgAuction) => {
    setEditingAuction(auc);
    setEditTitle(auc.title || '');
    setEditStartDate(getSaoPauloDateTimeLocal(auc.startDate));
    setEditEndDate(getSaoPauloDateTimeLocal(auc.endDate));
    setEditPaymentDeadlineHours(auc.paymentDeadlineHours || 48);
    setEditNotes(auc.notes || '');
    setIsEditAuctionOpen(true);
  };

  const handleEditStartDateChange = (val: string) => {
    setEditStartDate(val);
    if (val) {
      setEditEndDate(addDaysToDateTimeLocal(val, 1));
    }
  };

  const handleSaveEditAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAuction) return;
    try {
      setSubmittingEdit(true);
      await auctionService.updateAuction(editingAuction.id, {
        title: editTitle.trim() || null,
        startDate: parseDateInputToIso(editStartDate),
        endDate: parseDateInputToIso(editEndDate),
        paymentDeadlineHours: editPaymentDeadlineHours,
        notes: editNotes.trim() || null,
      });
      success(`Leilão #${editingAuction.code} atualizado com sucesso!`);
      setIsEditAuctionOpen(false);
      setEditingAuction(null);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar leilão.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleStartDateChange = (val: string) => {
    setPreStartDate(val);
    if (val) {
      setPreEndDate(addDaysToDateTimeLocal(val, 1));
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Ações do Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-trigon-900/90 border border-trigon-800 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-crimson-950/60 border border-crimson-500/30 text-crimson-400">
            <Gavel className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-white uppercase tracking-wider block font-cinzel">
              Listagem de Leilões
            </span>
            <span className="text-xs text-trigon-400">
              {auctions.length} {auctions.length === 1 ? 'leilão registrado' : 'leilões registrados'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsPastAuctionOpen(true)}
            icon={<History className="w-4 h-4 text-trigon-300" />}
          >
            Registrar Leilão Passado
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setPreAuctionCode(auctionService.formatAuctionCode(nextSuggestedNum));
              const sp = getSaoPauloDateTimeLocal();
              const [dPart, tPart] = sp.split('T');
              const startStr = `${dPart}T${tPart.slice(0, 2)}:00`;
              setPreStartDate(startStr);
              setPreEndDate(addDaysToDateTimeLocal(startStr, 1));
              setIsNewPreAuctionOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Novo Pré-Leilão
          </Button>
        </div>
      </div>

      {/* Lista de Cards de Leilões em Ordem Decrescente */}
      {auctions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-trigon-900/80 border border-trigon-800 space-y-4 shadow-lg">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-crimson-950/60 border border-crimson-500/30 flex items-center justify-center text-crimson-400">
            <Gavel className="w-8 h-8" />
          </div>
          <div>
            <h4 className="font-cinzel text-lg font-bold text-white">Nenhum Leilão Cadastrado</h4>
            <p className="text-sm text-trigon-400 mt-1 max-w-md mx-auto">
              Crie o seu primeiro pré-leilão para o próximo evento ou registre retroativamente os leilões que já foram realizados.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsPastAuctionOpen(true)}>
              Registrar Passado (#001 a #008)
            </Button>
            <Button variant="primary" onClick={() => setIsNewPreAuctionOpen(true)}>
              + Criar Pré-Leilão
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedAuctions.map((auc) => {
            const isEmAndamento = auc.status === 'EM_ANDAMENTO';
            const isFinalizado = auc.status === 'FINALIZADO';
            const hasLotes = (auc.itemsCount || 0) > 0;
            const arrematadasPct =
              hasLotes && (auc.arrematadosCount || 0) > 0
                ? Math.round(((auc.arrematadosCount || 0) / (auc.itemsCount || 1)) * 100)
                : null;

            return (
              <div
                key={auc.id}
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                  isEmAndamento
                    ? 'bg-gradient-to-r from-emerald-950/25 via-trigon-900 to-trigon-900 border-l-4 border-l-emerald-500 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
                    : isFinalizado
                      ? 'bg-trigon-900/95 border-l-4 border-l-trigon-700 border-trigon-800 hover:border-trigon-700 shadow-md shadow-black/40'
                      : 'bg-gradient-to-r from-amber-950/20 via-trigon-900 to-trigon-900 border-l-4 border-l-amber-500 border-amber-500/30 hover:border-amber-500/50 shadow-md shadow-black/40'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Identificação e Cabeçalho do Leilão */}
                  <div className="flex items-start gap-3.5">
                    {/* Ícone contextual moderno sem duplicar o título */}
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-md transition-all ${
                        isEmAndamento
                          ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-400 shadow-emerald-950/50'
                          : isFinalizado
                            ? 'bg-trigon-800/90 border-trigon-700 text-trigon-300'
                            : 'bg-amber-950/80 border-amber-500/50 text-amber-300 shadow-amber-950/40'
                      }`}
                    >
                      {isEmAndamento ? (
                        <Gavel className="w-5 h-5 animate-pulse" />
                      ) : isFinalizado ? (
                        <Gavel className="w-5 h-5 text-trigon-300" />
                      ) : (
                        <Sparkles className="w-5 h-5 text-amber-300" />
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Tag com o Código do Leilão */}
                        <span
                          className={`font-mono text-xs font-black px-2.5 py-0.5 rounded-lg border tracking-wider shadow-sm ${
                            isEmAndamento
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                              : isFinalizado
                                ? 'bg-trigon-800 text-trigon-200 border-trigon-700'
                                : 'bg-amber-950/90 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          #{auc.code}
                        </span>

                        {/* Título Principal */}
                        <h4 className="font-cinzel text-base sm:text-lg font-bold text-white tracking-wide">
                          {auc.title || `Leilão #${auc.code}`}
                        </h4>

                        {/* Badge de Status */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isEmAndamento
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                              : isFinalizado
                                ? 'bg-trigon-800/80 text-trigon-300 border border-trigon-700'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {isEmAndamento && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                          )}
                          {isEmAndamento
                            ? 'Em Andamento (24h)'
                            : isFinalizado
                              ? 'Finalizado'
                              : 'Pré-Leilão (Em Montagem)'}
                        </span>
                      </div>

                      {/* Subtítulo: Período e Prazos */}
                      <div className="flex items-center gap-3.5 text-xs text-trigon-400 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 font-mono text-trigon-300">
                          <Calendar className="w-3.5 h-3.5 text-crimson-400" />
                          <span>{formatAuctionPeriod(auc.startDate, auc.endDate)}</span>
                        </span>
                        {auc.paymentDeadlineHours ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-trigon-400 bg-trigon-950/60 px-2 py-0.5 rounded-md border border-trigon-800">
                            <Clock className="w-3 h-3 text-trigon-500" />
                            Cobrança em {auc.paymentDeadlineHours}h
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Botões de Ação do Card */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    <button
                      type="button"
                      onClick={() => handleOpenEditAuction(auc)}
                      title="Editar informações do leilão (título, datas, prazos)"
                      className="p-2.5 rounded-xl bg-trigon-800 hover:bg-trigon-750 border border-trigon-700 text-trigon-300 hover:text-white transition-all shadow-sm shrink-0"
                    >
                      <Edit3 className="w-4 h-4 text-crimson-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectAuction(auc.id)}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                        isEmAndamento
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                          : isFinalizado
                            ? 'bg-trigon-800 hover:bg-trigon-750 border border-trigon-700 text-white'
                            : 'bg-gradient-to-r from-crimson-700 to-crimson-600 hover:from-crimson-600 hover:to-crimson-500 text-white shadow-crimson-950/40'
                      }`}
                    >
                      <span>Gerenciar Lotes & Fechamento</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Métricas Consolidadas do Leilão - Boxes Sólidos e Informativos */}
                <div className="mt-4 pt-4 border-t border-trigon-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {/* 1. Lotes */}
                  <div className="p-3 rounded-xl bg-trigon-950/80 border border-trigon-800 hover:border-trigon-750 transition-colors flex flex-col justify-between">
                    <span className="text-[10px] uppercase text-trigon-400 font-semibold flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-trigon-400" />
                      Total Lotes
                    </span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="font-mono text-sm font-bold text-white">
                        {auc.itemsCount || 0}
                      </span>
                      <span className="text-[10px] text-trigon-500">
                        {auc.itemsCount === 1 ? 'carta' : 'cartas'}
                      </span>
                    </div>
                  </div>

                  {/* 2. Arrematadas */}
                  <div className="p-3 rounded-xl bg-trigon-950/80 border border-trigon-800 hover:border-trigon-750 transition-colors flex flex-col justify-between">
                    <span className="text-[10px] uppercase text-trigon-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Arrematadas
                    </span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="font-mono text-sm font-bold text-emerald-400">
                        {auc.arrematadosCount || 0} un.
                      </span>
                      {arrematadasPct !== null ? (
                        <span className="text-[10px] font-mono font-semibold text-emerald-400/80">
                          {arrematadasPct}%
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* 3. Total Arrematado */}
                  <div className="p-3 rounded-xl bg-trigon-950/80 border border-trigon-800 hover:border-trigon-750 transition-colors flex flex-col justify-between">
                    <span className="text-[10px] uppercase text-trigon-400 font-semibold flex items-center gap-1.5">
                      <Coins className="w-3 h-3 text-emerald-400" />
                      Total Vendido
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-300 block mt-1 truncate">
                      {formatCurrency(auc.totalArrematado || 0)}
                    </span>
                  </div>

                  {/* 4. Valor Pendente */}
                  <div
                    className={`p-3 rounded-xl border transition-colors flex flex-col justify-between ${
                      (auc.totalPendente || 0) > 0
                        ? 'bg-amber-950/20 border-amber-500/30'
                        : 'bg-trigon-950/80 border-trigon-800'
                    }`}
                  >
                    <span className="text-[10px] uppercase text-trigon-400 font-semibold flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Valor Pendente
                    </span>
                    <span
                      className={`font-mono text-sm font-bold block mt-1 truncate ${
                        (auc.totalPendente || 0) > 0 ? 'text-amber-300' : 'text-trigon-400'
                      }`}
                    >
                      {formatCurrency(auc.totalPendente || 0)}
                    </span>
                  </div>

                  {/* 5. Custo Lotes */}
                  <div className="p-3 rounded-xl bg-trigon-950/80 border border-trigon-800 hover:border-trigon-750 transition-colors flex flex-col justify-between">
                    <span className="text-[10px] uppercase text-trigon-400 font-semibold flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-trigon-400" />
                      Custo Lotes
                    </span>
                    <span className="font-mono text-sm font-bold text-trigon-300 block mt-1 truncate">
                      {formatCurrency(auc.totalCusto || 0)}
                    </span>
                  </div>

                  {/* 6. Lucro Líquido */}
                  <div
                    className={`p-3 rounded-xl border transition-colors flex flex-col justify-between ${
                      (auc.totalLucro || 0) > 0
                        ? 'bg-emerald-950/20 border-emerald-500/25'
                        : (auc.totalLucro || 0) < 0
                          ? 'bg-crimson-950/20 border-crimson-500/25'
                          : 'bg-trigon-950/80 border-trigon-800'
                    }`}
                  >
                    <span className="text-[10px] uppercase text-trigon-400 font-semibold flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      Lucro Líquido
                    </span>
                    <span
                      className={`font-mono text-sm font-bold block mt-1 truncate ${
                        (auc.totalLucro || 0) > 0
                          ? 'text-emerald-400'
                          : (auc.totalLucro || 0) < 0
                            ? 'text-crimson-400'
                            : 'text-trigon-400'
                      }`}
                    >
                      {formatCurrency(auc.totalLucro || 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {auctions.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={auctions.length}
              itemsPerPage={auctionsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(newSize) => {
                setAuctionsPerPage(newSize);
                setCurrentPage(1);
              }}
              itemsPerPageOptions={[3, 5, 10, 20]}
              itemLabel="leilão(ões)"
              className="rounded-2xl border border-trigon-800 bg-trigon-900/90 shadow-md p-3"
            />
          )}
        </div>
      )}

      {/* Modal: Novo Pré-Leilão */}
      <Modal
        isOpen={isNewPreAuctionOpen}
        onClose={() => setIsNewPreAuctionOpen(false)}
        title="Criar Novo Pré-Leilão"
        maxWidth="lg"
      >
        <form onSubmit={handleCreatePreAuction} className="space-y-4">
          <p className="text-xs text-trigon-400">
            Configure a data e o horário inicial do leilão. Você poderá adicionar cartas e itens avulsos antes de dar início ao evento de 24 horas.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Identificador / ID *
              </label>
              <input
                type="text"
                value={preAuctionCode}
                onChange={(e) => setPreAuctionCode(e.target.value)}
                placeholder="Ex: 009"
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 font-mono text-white text-sm focus:outline-none focus:border-crimson-500 font-bold"
                required
              />
              <span className="text-[10px] text-trigon-500 mt-0.5 block">
                Formatado automaticamente (001, 009...)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Título ou Nome (Opcional)
              </label>
              <input
                type="text"
                value={preAuctionTitle}
                onChange={(e) => setPreAuctionTitle(e.target.value)}
                placeholder="Ex: Leilão Especial Scarlet & Violet"
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Data e Hora de Início *
              </label>
              <input
                type="datetime-local"
                value={preStartDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Data e Hora de Fim (24 Horas) *
              </label>
              <input
                type="datetime-local"
                value={preEndDate}
                onChange={(e) => setPreEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Prazo para Pagamento dos Arremates (Horas)
            </label>
            <input
              type="number"
              min="1"
              value={prePaymentDeadlineHours}
              onChange={(e) => setPrePaymentDeadlineHours(parseInt(e.target.value, 10) || 48)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-mono"
            />
            <span className="text-[10px] text-trigon-500 mt-0.5 block">
              Padrão TRIGON: 48 horas (2 dias corridos)
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Observações Internas (Opcional)
            </label>
            <textarea
              rows={2}
              value={preNotes}
              onChange={(e) => setPreNotes(e.target.value)}
              placeholder="Anotações internas sobre os lotes deste leilão..."
              className="w-full px-3.5 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-trigon-800">
            <Button type="button" variant="secondary" onClick={() => setIsNewPreAuctionOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Salvar Pré-Leilão
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Registrar Leilão Passado */}
      <Modal
        isOpen={isPastAuctionOpen}
        onClose={() => setIsPastAuctionOpen(false)}
        title="Registrar Leilão Passado (Histórico #001 a #008)"
        maxWidth="lg"
      >
        <form onSubmit={handleRegisterPastAuction} className="space-y-4">
          <p className="text-xs text-trigon-400">
            Permite registrar retroativamente os leilões que você já realizou para alimentar os relatórios financeiros consolidados. Este leilão já será salvo como <strong>FINALIZADO</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                ID do Leilão *
              </label>
              <input
                type="text"
                value={pastAuctionCode}
                onChange={(e) => setPastAuctionCode(e.target.value)}
                placeholder="Ex: 001"
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 font-mono text-white text-sm focus:outline-none focus:border-crimson-500 font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Título ou Referência
              </label>
              <input
                type="text"
                value={pastAuctionTitle}
                onChange={(e) => setPastAuctionTitle(e.target.value)}
                placeholder="Ex: Leilão #001 - Inaugural"
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Data Inicial Realizada
              </label>
              <input
                type="date"
                value={pastStartDate}
                onChange={(e) => setPastStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Data Final Realizada
              </label>
              <input
                type="date"
                value={pastEndDate}
                onChange={(e) => setPastEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Observações
            </label>
            <input
              type="text"
              value={pastNotes}
              onChange={(e) => setPastNotes(e.target.value)}
              placeholder="Ex: Realizado no grupo VIP do WhatsApp"
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-trigon-800">
            <Button type="button" variant="secondary" onClick={() => setIsPastAuctionOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Salvar Leilão Passado
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Informações do Leilão */}
      <Modal
        isOpen={isEditAuctionOpen}
        onClose={() => {
          setIsEditAuctionOpen(false);
          setEditingAuction(null);
        }}
        title={`Editar Leilão #${editingAuction?.code || ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEditAuction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Título / Descrição do Leilão (Opcional)
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
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
                value={editStartDate}
                onChange={(e) => handleEditStartDateChange(e.target.value)}
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
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
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
              value={editPaymentDeadlineHours}
              onChange={(e) => setEditPaymentDeadlineHours(Number(e.target.value))}
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
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Instruções internas ou notas sobre o evento..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-trigon-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsEditAuctionOpen(false);
                setEditingAuction(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={submittingEdit}>
              Salvar Alterações do Leilão
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
