import React, { useState, useEffect } from 'react';
import {
  Customer,
  QuestModel,
  CustomerQuest,
  CustomerQuestProgress,
  QuestClosure,
  QuestStep,
  QuestModality,
  QuestStepStatus,
} from '../../types';
import { questService, normalizePieceName } from '../../services/questService';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { formatDateTime, formatCurrency, getSaoPauloDateTimeLocal } from '../../utils/formatters';
import {
  Compass,
  Trophy,
  Plus,
  AlertTriangle,
  Clock,
  Send,
  XCircle,
  DollarSign,
  PackageCheck,
  Loader2,
  History,
  ShieldCheck,
} from 'lucide-react';

interface CustomerQuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

export const CustomerQuestModal: React.FC<CustomerQuestModalProps> = ({
  isOpen,
  onClose,
  customer,
}) => {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<CustomerQuestProgress | null>(null);
  const [activeQuest, setActiveQuest] = useState<CustomerQuest | null>(null);
  const [history, setHistory] = useState<CustomerQuest[]>([]);
  const [models, setModels] = useState<QuestModel[]>([]);
  const [closures, setClosures] = useState<QuestClosure[]>([]);

  // Start Quest Form State
  const [isStartingQuest, setIsStartingQuest] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedModality, setSelectedModality] = useState<QuestModality>('jornada');
  const [submittingStart, setSubmittingStart] = useState(false);

  // Add Step Form State
  const [isAddStepOpen, setIsAddStepOpen] = useState(false);
  const [pieceName, setPieceName] = useState('');
  const [stepStatus, setStepStatus] = useState<QuestStepStatus>('conquistada');
  const [stepDate, setStepDate] = useState('');
  const [stepNotes, setStepNotes] = useState('');
  const [selectedClosureId, setSelectedClosureId] = useState('');
  const [isNewClosure, setIsNewClosure] = useState(false);
  const [newClosureValue, setNewClosureValue] = useState('100');
  const [newClosureRef, setNewClosureRef] = useState('');

  // Duplicate Exception State
  const [isException, setIsException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submittingStep, setSubmittingStep] = useState(false);

  // Cancel Quest State
  const [isCancelQuestOpen, setIsCancelQuestOpen] = useState(false);
  const [cancelQuestReason, setCancelQuestReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Cancel Step State
  const [cancelStepTarget, setCancelStepTarget] = useState<QuestStep | null>(null);
  const [cancelStepReason, setCancelStepReason] = useState('');
  const [submittingCancelStep, setSubmittingCancelStep] = useState(false);

  const { success, error, info } = useToast();

  const loadData = async () => {
    if (!customer) return;
    try {
      setLoading(true);
      const [prog, active, hist, allModels, unusedClosures] = await Promise.all([
        questService.getCustomerProgress(customer.id),
        questService.getActiveCustomerQuest(customer.id),
        questService.getCustomerQuestHistory(customer.id),
        questService.getModels({ activeOnly: true }),
        questService.getCustomerClosures(customer.id, true),
      ]);
      setProgress(prog);
      setActiveQuest(active);
      setHistory(hist);
      setModels(allModels);
      setClosures(unusedClosures);
    } catch (err: any) {
      console.error(err);
      error('Erro ao carregar dados do programa Quest deste cliente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customer) {
      loadData();
      setIsStartingQuest(false);
      setIsAddStepOpen(false);
      setIsCancelQuestOpen(false);
    }
  }, [isOpen, customer]);

  // Handler para iniciar uma nova Quest
  const handleStartQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !selectedModelId) {
      info('Selecione um modelo Quest.');
      return;
    }

    try {
      setSubmittingStart(true);
      await questService.startCustomerQuest({
        customerId: customer.id,
        modelId: selectedModelId,
        modality: selectedModality,
      });

      success('Quest iniciada com sucesso para o cliente!');
      setIsStartingQuest(false);
      setSelectedModelId('');
      await loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao iniciar Quest.');
    } finally {
      setSubmittingStart(false);
    }
  };

  // Handler para verificar duplicidade de peça em tempo real
  const handlePieceNameChange = (name: string) => {
    setPieceName(name);
    if (!activeQuest || !name.trim()) {
      setDuplicateWarning(null);
      return;
    }

    const normalized = normalizePieceName(name);
    const existing = (activeQuest.steps || []).find(
      (s) => s.normalizedPieceName === normalized && s.status !== 'cancelada'
    );

    if (existing) {
      setDuplicateWarning(
        `A peça "${existing.pieceName}" já foi registrada nesta participação (Etapa ${existing.stepNumber}, Situação: ${existing.status}).`
      );
    } else {
      setDuplicateWarning(null);
      setIsException(false);
      setExceptionReason('');
    }
  };

  // Handler para abrir modal de registrar peça
  const handleOpenAddStep = () => {
    setPieceName('');
    setStepStatus('conquistada');
    setStepDate(getSaoPauloDateTimeLocal());
    setStepNotes('');
    setSelectedClosureId('');
    setIsNewClosure(false);
    setNewClosureValue('100');
    setNewClosureRef('');
    setIsException(false);
    setExceptionReason('');
    setDuplicateWarning(null);
    setIsAddStepOpen(true);
  };

  // Handler para salvar peça
  const handleSaveStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuest || !customer) return;
    if (!pieceName.trim()) {
      info('Informe o nome da peça.');
      return;
    }

    if (duplicateWarning && !isException) {
      info('Atenção: confirme a autorização de exceção para salvar peça repetida.');
      return;
    }

    if (duplicateWarning && isException && !exceptionReason.trim()) {
      info('A justificativa administrativa é obrigatória para registrar peça repetida.');
      return;
    }

    try {
      setSubmittingStep(true);
      let closureIdToUse = selectedClosureId || null;

      // Se optou por registrar um novo fechamento agora
      if (isNewClosure) {
        const val = Number(newClosureValue);
        if (isNaN(val) || val < 100) {
          info('O valor do fechamento deve ser no mínimo R$ 100,00.');
          setSubmittingStep(false);
          return;
        }

        const createdClosure = await questService.createClosure({
          customerId: customer.id,
          totalValue: val,
          closureDate: stepDate,
          saleReference: newClosureRef,
          notes: 'Registrado diretamente na conquista de peça Quest',
        });
        closureIdToUse = createdClosure.id;
      }

      const { completionResult } = await questService.addQuestStep({
        customerQuestId: activeQuest.id,
        pieceName: pieceName.trim(),
        status: stepStatus,
        closureId: closureIdToUse,
        notes: stepNotes.trim(),
        isException,
        exceptionReason: isException ? exceptionReason.trim() : '',
        date: stepDate,
      });

      if (completionResult && completionResult.completed) {
        success(
          `🏆 PARABÉNS! Todas as peças foram enviadas! Quest concluída com sucesso! O cliente avançou para o Nível ${completionResult.new_level}!`
        );
      } else {
        success(`Peça "${pieceName}" registrada com sucesso!`);
      }

      setIsAddStepOpen(false);
      await loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao registrar peça.');
    } finally {
      setSubmittingStep(false);
    }
  };

  // Handler para transição rápida de situação de peça
  const handleQuickAdvanceStep = async (step: QuestStep, nextStatus: QuestStepStatus) => {
    try {
      const { completionResult } = await questService.updateQuestStepStatus(step.id, nextStatus);

      if (completionResult && completionResult.completed) {
        success(
          `🏆 PARABÉNS! Todas as peças foram enviadas! Quest concluída! Cliente promovido ao Nível ${completionResult.new_level}!`
        );
      } else {
        success(`Situação da peça atualizada para "${nextStatus}".`);
      }
      await loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar situação da peça.');
    }
  };

  // Handler para cancelar Quest
  const handleConfirmCancelQuest = async () => {
    if (!activeQuest || !cancelQuestReason.trim()) {
      info('Informe a justificativa do cancelamento da Quest.');
      return;
    }
    try {
      setSubmittingCancel(true);
      await questService.cancelCustomerQuest(activeQuest.id, cancelQuestReason.trim());
      success('Quest cancelada com sucesso.');
      setIsCancelQuestOpen(false);
      setCancelQuestReason('');
      await loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao cancelar Quest.');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Handler para cancelar Etapa
  const handleConfirmCancelStep = async () => {
    if (!cancelStepTarget || !cancelStepReason.trim()) {
      info('Informe o motivo do cancelamento da etapa.');
      return;
    }
    try {
      setSubmittingCancelStep(true);
      await questService.cancelQuestStep(cancelStepTarget.id, cancelStepReason.trim());
      success('Etapa cancelada e removida do cômputo de progresso.');
      setCancelStepTarget(null);
      setCancelStepReason('');
      await loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao cancelar etapa.');
    } finally {
      setSubmittingCancelStep(false);
    }
  };

  // Modelos elegíveis para a seleção
  const eligibleModels = models.filter((m) => {
    if (!m.isActive) return false;
    if (selectedModality === 'jornada') {
      return m.level === (progress?.currentLevel || 1);
    }
    return true; // Quest Livre aceita qualquer nível ativo
  });

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Quest TRIGON — Programa de Fidelidade"
        description={
          customer
            ? `Acompanhamento de modelos colecionáveis e progresso de ${customer.name}`
            : undefined
        }
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {/* BANNER DE NÍVEL PESSOAL DO CLIENTE */}
          <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-r from-trigon-950 via-crimson-950/40 to-trigon-950 border border-crimson-600/40 shadow-glow-crimson">
            <div className="absolute -right-8 -top-8 w-48 h-48 bg-crimson-600/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {/* Emblema de Nível */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-crimson-900/80 to-crimson-950 border border-crimson-500/50 flex flex-col items-center justify-center shadow-md shadow-crimson-950/60 shrink-0">
                  <span className="text-[9px] uppercase font-bold text-crimson-300 tracking-wider leading-none">
                    Nível
                  </span>
                  <span className="text-xl font-cinzel font-bold text-white leading-none mt-1">
                    {progress?.currentLevel || 1}
                  </span>
                </div>

                {/* Título do Colecionador e Progresso */}
                <div className="flex flex-col justify-center">
                  <h3 className="text-base font-bold text-white tracking-wide leading-tight">
                    Nível {progress?.currentLevel || 1} do Colecionador
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-trigon-300 mt-1.5">
                    <span>Quests Concluídas com Sucesso:</span>
                    <span className="font-mono font-bold text-white bg-trigon-900/80 px-1.5 py-0.5 rounded border border-trigon-800 text-[11px] leading-none">
                      {progress?.totalQuestsCompleted || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tag Nível Máximo */}
              <div className="flex items-center gap-2 text-xs text-trigon-300 bg-trigon-900/70 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-trigon-800 self-start sm:self-auto shrink-0 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-trigon-400">Nível Máximo:</span>
                <strong className="font-mono font-bold text-white">5</strong>
              </div>
            </div>
          </div>

          {/* SESSÃO 1: QUEST ATIVA EM ANDAMENTO */}
          {loading ? (
            <div className="p-8 text-center text-trigon-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-crimson-500" />
              <span>Carregando dados da Quest...</span>
            </div>
          ) : activeQuest ? (
            <div className="space-y-4 bg-trigon-950/80 border border-trigon-750 rounded-2xl p-5 shadow-inner">
              {/* Header da Quest Ativa */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-trigon-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 rounded-xl bg-trigon-900 border border-trigon-750 flex items-center justify-center overflow-hidden shrink-0">
                    {activeQuest.model?.imageUrl ? (
                      <img
                        src={activeQuest.model.imageUrl}
                        alt={activeQuest.model.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Trophy className="w-6 h-6 text-crimson-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-white truncate">
                        {activeQuest.model?.name}
                      </h4>
                      <Badge variant="crimson">Nível {activeQuest.model?.level}</Badge>
                      <Badge variant={activeQuest.modality === 'jornada' ? 'info' : 'warning'}>
                        {activeQuest.modality === 'jornada' ? 'Jornada TRIGON' : 'Quest Livre'}
                      </Badge>
                    </div>
                    <p className="text-xs text-trigon-400 mt-1">
                      Iniciada em: {formatDateTime(activeQuest.startedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleOpenAddStep}
                    disabled={
                      (activeQuest.steps || []).filter((s) => s.status !== 'cancelada').length >=
                      (activeQuest.model?.piecesCount || 5)
                    }
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Nova Peça
                  </Button>

                  <button
                    onClick={() => setIsCancelQuestOpen(true)}
                    className="p-2 rounded-xl text-trigon-500 hover:text-crimson-400 hover:bg-crimson-950/30 border border-transparent hover:border-crimson-900/40 transition-all text-xs"
                    title="Cancelar Quest em Andamento"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* BARRA DE PROGRESSO PRINCIPAL (Considera ENVIADAS como conclusão) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-trigon-300 flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-emerald-400" />
                    <span>Progresso de Envio (Conclusão):</span>
                  </span>
                  <span className="text-emerald-300 font-mono text-sm">
                    {activeQuest.sentPiecesCount || 0} / {activeQuest.model?.piecesCount || 5} peças enviadas
                  </span>
                </div>

                {/* Barra Visual */}
                <div className="w-full h-3 bg-trigon-900 rounded-full overflow-hidden border border-trigon-800 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-crimson-600 via-amber-500 to-emerald-400 rounded-full transition-all duration-500 shadow-md shadow-emerald-500/30"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((activeQuest.sentPiecesCount || 0) / (activeQuest.model?.piecesCount || 5)) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>

                {/* Sub-indicadores de Peças */}
                <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-800/30 text-emerald-300">
                    <span className="block font-bold text-sm font-mono">{activeQuest.sentPiecesCount || 0}</span>
                    <span className="text-[10px] text-emerald-400 uppercase">Enviadas</span>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-800/30 text-amber-300">
                    <span className="block font-bold text-sm font-mono">{activeQuest.reservedPiecesCount || 0}</span>
                    <span className="text-[10px] text-amber-400 uppercase">Reservadas</span>
                  </div>
                  <div className="p-2 rounded-xl bg-sky-950/30 border border-sky-800/30 text-sky-300">
                    <span className="block font-bold text-sm font-mono">{activeQuest.conqueredPiecesCount || 0}</span>
                    <span className="text-[10px] text-sky-400 uppercase">Conquistadas</span>
                  </div>
                </div>
              </div>

              {/* TIMELINE / LISTA DE ETAPAS REGISTRADAS */}
              <div className="space-y-3 pt-3">
                <h5 className="text-xs uppercase font-bold text-trigon-400 tracking-wider">
                  Etapas e Peças Registradas ({activeQuest.steps?.length || 0})
                </h5>

                {activeQuest.steps?.length === 0 ? (
                  <div className="text-center py-6 bg-trigon-900/40 rounded-xl border border-trigon-800/60 p-4">
                    <Compass className="w-8 h-8 text-trigon-600 mx-auto mb-2" />
                    <p className="text-xs text-trigon-400">
                      Nenhuma peça registrada nesta Quest ainda. Clique em "+ Nova Peça" acima para lançar o primeiro fechamento elegível.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {activeQuest.steps?.map((step) => (
                      <div
                        key={step.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border text-xs transition-all ${
                          step.status === 'cancelada'
                            ? 'bg-trigon-950/40 border-trigon-800 opacity-50'
                            : 'bg-trigon-900/80 border-trigon-800 hover:border-trigon-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-trigon-800 text-trigon-200 font-mono font-bold flex items-center justify-center text-[11px] shrink-0">
                            {step.stepNumber}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-white truncate text-sm">
                                {step.pieceName}
                              </span>
                              <Badge
                                variant={
                                  step.status === 'enviada'
                                    ? 'success'
                                    : step.status === 'reservada'
                                    ? 'warning'
                                    : step.status === 'conquistada'
                                    ? 'info'
                                    : 'neutral'
                                }
                                size="sm"
                                dot
                              >
                                {step.status}
                              </Badge>

                              {step.isException && (
                                <Badge variant="crimson" size="sm">
                                  Exceção
                                </Badge>
                              )}
                            </div>

                            <p className="text-[11px] text-trigon-400 mt-0.5">
                              {step.sentAt
                                ? `Enviada em ${formatDateTime(step.sentAt)}`
                                : `Registrada em ${formatDateTime(step.earnedAt)}`}
                              {step.closure && (
                                <span className="ml-1 text-emerald-400 font-mono">
                                  • {formatCurrency(step.closure.totalValue)} ({step.closure.saleReference || 'Fechamento'})
                                </span>
                              )}
                            </p>

                            {step.notes && (
                              <p className="text-[11px] text-trigon-300 italic truncate mt-0.5">
                                Obs: {step.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Ações da Etapa */}
                        {step.status !== 'cancelada' && (
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            {step.status === 'conquistada' && (
                              <button
                                onClick={() => handleQuickAdvanceStep(step, 'reservada')}
                                className="px-2 py-1 rounded-lg bg-amber-950/60 border border-amber-600/40 text-amber-300 hover:bg-amber-900/60 text-[10px] font-semibold transition-all flex items-center gap-1"
                                title="Mudar para Reservada"
                              >
                                <Clock className="w-3 h-3" />
                                <span>Reservar</span>
                              </button>
                            )}

                            {step.status !== 'enviada' && (
                              <button
                                onClick={() => handleQuickAdvanceStep(step, 'enviada')}
                                className="px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/60 text-[10px] font-semibold transition-all flex items-center gap-1"
                                title="Marcar como Enviada"
                              >
                                <Send className="w-3 h-3" />
                                <span>Enviar</span>
                              </button>
                            )}

                            <button
                              onClick={() => setCancelStepTarget(step)}
                              className="p-1.5 rounded-lg text-trigon-500 hover:text-crimson-400 hover:bg-crimson-950/30 transition-colors"
                              title="Cancelar Etapa"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SE O CLIENTE NÃO POSSUIR QUEST ATIVA */
            <div className="p-6 text-center bg-trigon-950/80 rounded-2xl border border-trigon-800 space-y-4">
              <Compass className="w-12 h-12 text-crimson-500 mx-auto" />
              <div>
                <h4 className="text-base font-bold text-white">Nenhuma Quest em Andamento</h4>
                <p className="text-xs text-trigon-400 max-w-md mx-auto mt-1">
                  O cliente está livre para iniciar um novo modelo colecionável correspondente ao seu nível.
                </p>
              </div>

              {!isStartingQuest ? (
                <Button
                  variant="primary"
                  onClick={() => setIsStartingQuest(true)}
                  icon={<Compass className="w-4 h-4" />}
                >
                  Iniciar Nova Quest
                </Button>
              ) : (
                <form
                  onSubmit={handleStartQuest}
                  className="max-w-md mx-auto text-left bg-trigon-900 p-4 rounded-xl border border-trigon-750 space-y-4 animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-trigon-800">
                    <span className="text-xs font-bold uppercase text-white">Iniciar Nova Jornada</span>
                    <button
                      type="button"
                      onClick={() => setIsStartingQuest(false)}
                      className="text-xs text-trigon-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>

                  {/* Modalidade */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-trigon-300">
                      Modalidade de Participação
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedModality('jornada')}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                          selectedModality === 'jornada'
                            ? 'bg-crimson-950/80 border-crimson-600/60 text-white shadow-sm'
                            : 'bg-trigon-950 border-trigon-800 text-trigon-400 hover:text-white'
                        }`}
                      >
                        Jornada TRIGON
                        <span className="block text-[10px] text-trigon-400 font-normal mt-0.5">
                          (Nível {progress?.currentLevel || 1})
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedModality('livre')}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                          selectedModality === 'livre'
                            ? 'bg-amber-950/80 border-amber-600/60 text-amber-200 shadow-sm'
                            : 'bg-trigon-950 border-trigon-800 text-trigon-400 hover:text-white'
                        }`}
                      >
                        Quest Livre
                        <span className="block text-[10px] text-amber-400/80 font-normal mt-0.5">
                          (Qualquer Nível)
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Escolha do Modelo */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-trigon-300">
                      Modelo Colecionável <span className="text-crimson-400">*</span>
                    </label>
                    <select
                      value={selectedModelId}
                      onChange={(e) => setSelectedModelId(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
                    >
                      <option value="">-- Selecione o Modelo --</option>
                      {eligibleModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          Nível {m.level} • {m.name} ({m.piecesCount} peças)
                        </option>
                      ))}
                    </select>

                    {eligibleModels.length === 0 && (
                      <p className="text-[11px] text-amber-400 pt-1">
                        Nenhum modelo ativo disponível para o Nível {progress?.currentLevel || 1}. Cadastre ou ative modelos na página de Quests.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      loading={submittingStart}
                      disabled={!selectedModelId}
                    >
                      Confirmar Início
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* SESSÃO 2: HISTÓRICO DE QUESTS CONCLUÍDAS E ANTERIORES */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold text-trigon-400 tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-trigon-500" />
              <span>Histórico de Quests ({history.length})</span>
            </h4>

            {history.length === 0 ? (
              <p className="text-xs text-trigon-500 italic p-4 text-center bg-trigon-950/40 rounded-xl border border-trigon-850">
                Nenhuma Quest concluída ou cancelada anteriormente.
              </p>
            ) : (
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {history.map((quest) => (
                  <div
                    key={quest.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-trigon-950 border border-trigon-800 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-trigon-900 border border-trigon-750 flex items-center justify-center font-bold text-white">
                        {quest.model?.name?.charAt(0) || 'Q'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{quest.model?.name}</span>
                          <Badge
                            variant={quest.status === 'concluida' ? 'success' : 'neutral'}
                            size="sm"
                          >
                            {quest.status === 'concluida' ? 'Concluída' : 'Cancelada'}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-trigon-400">
                          {quest.completedAt
                            ? `Concluída em ${formatDateTime(quest.completedAt)}`
                            : `Cancelada em ${formatDateTime(quest.cancelledAt || quest.updatedAt)}`}
                          {quest.cancellationReason && ` (${quest.cancellationReason})`}
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono text-[11px] text-trigon-300">
                      Nível {quest.startedLevel}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* MODAL SECUNDÁRIO: REGISTRAR NOVA PEÇA */}
      <Modal
        isOpen={isAddStepOpen}
        onClose={() => setIsAddStepOpen(false)}
        title="Registrar Conquista de Peça"
        description="Cada fechamento elegível (mín. R$ 100) concede o direito a uma peça colecionável"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveStep} className="space-y-4">
          {/* Nome da Peça */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-trigon-300">
              Nome da Peça <span className="text-crimson-400">*</span>
            </label>
            <input
              type="text"
              value={pieceName}
              onChange={(e) => handlePieceNameChange(e.target.value)}
              placeholder="Ex: Braço Direito, Cabeça, Asas de Fogo, Base de Apoio..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>

          {/* ALERTA DE PEÇA REPETIDA */}
          {duplicateWarning && (
            <div className="p-4 rounded-xl bg-amber-950/50 border border-amber-500/50 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-sm font-bold text-amber-300">Atenção! Peça repetida detectada.</h5>
                  <p className="text-xs text-amber-200/90 mt-1">{duplicateWarning}</p>
                </div>
              </div>

              <div className="p-3 bg-amber-900/30 rounded-xl border border-amber-700/40 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-100 font-semibold">
                  <input
                    type="checkbox"
                    checked={isException}
                    onChange={(e) => setIsException(e.target.checked)}
                    className="rounded border-amber-600 text-crimson-600 focus:ring-0"
                  />
                  <span>Autorização excepcional de peça duplicada</span>
                </label>

                {isException && (
                  <div className="space-y-1 pt-1">
                    <label className="block text-[11px] text-amber-200 font-semibold">
                      Justificativa Administrativa Obrigatória <span className="text-crimson-400">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={exceptionReason}
                      onChange={(e) => setExceptionReason(e.target.value)}
                      placeholder="Explique o motivo da autorização excepcional desta peça repetida..."
                      required={isException}
                      className="w-full px-3 py-2 rounded-lg bg-trigon-950 border border-amber-600/50 text-white text-xs focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Situação da Peça */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-trigon-300">
                Situação Inicial
              </label>
              <select
                value={stepStatus}
                onChange={(e) => setStepStatus(e.target.value as QuestStepStatus)}
                className="w-full px-3 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
              >
                <option value="conquistada">Conquistada (Aguardando Separação)</option>
                <option value="reservada">Reservada (Separada para Envio)</option>
                <option value="enviada">Enviada (Efetivamente Despachada)</option>
              </select>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-trigon-300">
                Data do Registro
              </label>
              <input
                type="datetime-local"
                value={stepDate}
                onChange={(e) => setStepDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
              />
            </div>
          </div>

          {/* Vínculo com Fechamento Elegível */}
          <div className="space-y-2.5 p-3.5 rounded-xl bg-trigon-950 border border-trigon-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fechamento Elegível (Mín. R$ 100)</span>
              </label>
              <button
                type="button"
                onClick={() => setIsNewClosure(!isNewClosure)}
                className="text-xs text-crimson-400 hover:text-crimson-300 font-semibold"
              >
                {isNewClosure ? 'Selecionar Existente' : '+ Lançar Novo Fechamento'}
              </button>
            </div>

            {!isNewClosure ? (
              <select
                value={selectedClosureId}
                onChange={(e) => setSelectedClosureId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
              >
                <option value="">-- Opcional: Selecione um fechamento disponível --</option>
                {closures.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {formatCurrency(cl.totalValue)} • {formatDateTime(cl.closureDate)} {cl.saleReference ? `(${cl.saleReference})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-trigon-400 mb-1">
                    Valor Fechamento (R$)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="0.01"
                    value={newClosureValue}
                    onChange={(e) => setNewClosureValue(e.target.value)}
                    required={isNewClosure}
                    className="w-full px-3 py-1.5 rounded-lg bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-trigon-400 mb-1">
                    Referência / Venda
                  </label>
                  <input
                    type="text"
                    value={newClosureRef}
                    onChange={(e) => setNewClosureRef(e.target.value)}
                    placeholder="Ex: Venda WhatsApp #8472"
                    className="w-full px-3 py-1.5 rounded-lg bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-trigon-300">
              Observações (opcional)
            </label>
            <input
              type="text"
              value={stepNotes}
              onChange={(e) => setStepNotes(e.target.value)}
              placeholder="Ex: Peça cromada especial, envio junto com caixa..."
              className="w-full px-3.5 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-trigon-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAddStepOpen(false)}
              disabled={submittingStep}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submittingStep}
              disabled={duplicateWarning !== null && (!isException || !exceptionReason.trim())}
            >
              Registrar Peça
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRMAÇÃO DE CANCELAMENTO DE QUEST */}
      <Modal
        isOpen={isCancelQuestOpen}
        onClose={() => setIsCancelQuestOpen(false)}
        title="Cancelar Quest em Andamento?"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/30 text-crimson-400 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="text-xs sm:text-sm text-trigon-300 leading-relaxed pt-1">
              Deseja realmente cancelar a Quest "{activeQuest?.model?.name}"? Esta ação liberará o cliente para iniciar outro modelo, mas encerrará a participação atual como cancelada.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-trigon-300">
              Motivo do Cancelamento <span className="text-crimson-400">*</span>
            </label>
            <textarea
              rows={2}
              value={cancelQuestReason}
              onChange={(e) => setCancelQuestReason(e.target.value)}
              placeholder="Informe o motivo administrativo para o cancelamento..."
              required
              className="w-full px-3 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-trigon-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCancelQuestOpen(false)}
              disabled={submittingCancel}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmCancelQuest}
              loading={submittingCancel}
              disabled={!cancelQuestReason.trim()}
            >
              Confirmar Cancelamento
            </Button>
          </div>
        </div>
      </Modal>

      {/* CONFIRMAÇÃO DE CANCELAMENTO DE ETAPA */}
      <Modal
        isOpen={!!cancelStepTarget}
        onClose={() => setCancelStepTarget(null)}
        title="Cancelar Etapa/Peça Registrada?"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-trigon-300 leading-relaxed">
            Deseja cancelar o registro da peça "{cancelStepTarget?.pieceName}"? Se houver fechamento associado, ele será liberado para uso futuro.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-trigon-300">
              Motivo do Cancelamento da Etapa <span className="text-crimson-400">*</span>
            </label>
            <input
              type="text"
              value={cancelStepReason}
              onChange={(e) => setCancelStepReason(e.target.value)}
              placeholder="Ex: Erro de digitação no nome, fechamento estornado..."
              required
              className="w-full px-3 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-trigon-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCancelStepTarget(null)}
              disabled={submittingCancelStep}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmCancelStep}
              loading={submittingCancelStep}
              disabled={!cancelStepReason.trim()}
            >
              Cancelar Peça
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
