import {
  QuestModel,
  CustomerQuestProgress,
  QuestClosure,
  CustomerQuest,
  QuestStep,
  QuestModality,
  QuestStepStatus,
  CustomerQuestStatus,
} from '../types';
import { supabase } from '../lib/supabase';
import { parseSaoPauloDateTime } from '../utils/formatters';

// Helper de normalização de nome de peça (ignora maiúsculas/minúsculas, acentos e múltiplos espaços)
export function normalizePieceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function mapModel(row: any): QuestModel {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    imageUrl: row.image_url || '',
    piecesCount: Number(row.pieces_count) || 0,
    level: Number(row.level) || 1,
    minValue: Number(row.min_value) || 100,
    assemblyInstructions: row.assembly_instructions || '',
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activeParticipantsCount: row.active_count !== undefined ? Number(row.active_count) : undefined,
    completedParticipantsCount: row.completed_count !== undefined ? Number(row.completed_count) : undefined,
  };
}

function mapClosure(row: any): QuestClosure {
  return {
    id: row.id,
    customerId: row.customer_id,
    totalValue: Number(row.total_value) || 0,
    closureDate: row.closure_date,
    saleReference: row.sale_reference || '',
    notes: row.notes || '',
    isUsed: row.is_used ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStep(row: any): QuestStep {
  return {
    id: row.id,
    customerQuestId: row.customer_quest_id,
    stepNumber: Number(row.step_number) || 1,
    pieceName: row.piece_name,
    normalizedPieceName: row.normalized_piece_name,
    status: row.status as QuestStepStatus,
    closureId: row.closure_id || null,
    notes: row.notes || '',
    earnedAt: row.earned_at,
    reservedAt: row.reserved_at || null,
    sentAt: row.sent_at || null,
    isException: row.is_exception ?? false,
    exceptionReason: row.exception_reason || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closure: row.quest_closures ? mapClosure(row.quest_closures) : undefined,
  };
}

function mapCustomerQuest(row: any): CustomerQuest {
  const steps: QuestStep[] = Array.isArray(row.quest_steps)
    ? row.quest_steps.map(mapStep).sort((a: QuestStep, b: QuestStep) => a.stepNumber - b.stepNumber)
    : [];

  const sentCount = steps.filter((s) => s.status === 'enviada').length;
  const reservedCount = steps.filter((s) => s.status === 'reservada').length;
  const conqueredCount = steps.filter((s) => s.status === 'conquistada').length;

  return {
    id: row.id,
    customerId: row.customer_id,
    modelId: row.model_id,
    modality: row.modality as QuestModality,
    status: row.status as CustomerQuestStatus,
    startedLevel: Number(row.started_level) || 1,
    startedAt: row.started_at,
    completedAt: row.completed_at || null,
    cancelledAt: row.cancelled_at || null,
    cancellationReason: row.cancellation_reason || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    model: row.quest_models ? mapModel(row.quest_models) : undefined,
    customer: row.customers
      ? {
          id: row.customers.id,
          name: row.customers.name,
          phone: row.customers.phone,
          email: row.customers.email,
        } as any
      : undefined,
    steps,
    sentPiecesCount: sentCount,
    reservedPiecesCount: reservedCount,
    conqueredPiecesCount: conqueredCount,
  };
}

export const questService = {
  normalizePieceName,

  // =========================================================================
  // MODELOS DE QUEST (quest_models)
  // =========================================================================

  async getModels(filter?: { search?: string; level?: number; activeOnly?: boolean }): Promise<QuestModel[]> {
    let query = supabase
      .from('quest_models')
      .select('*')
      .order('level', { ascending: true })
      .order('name', { ascending: true });

    if (filter?.activeOnly) {
      query = query.eq('is_active', true);
    }
    if (filter?.level) {
      query = query.eq('level', filter.level);
    }
    if (filter?.search && filter.search.trim()) {
      const term = filter.search.trim();
      query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    }

    const { data: modelsData, error: modelsError } = await query;
    if (modelsError) {
      console.error('Erro ao buscar modelos Quest:', modelsError);
      throw new Error(modelsError.message);
    }

    // Buscar contagem de participantes ativos e concluídos
    const { data: participations, error: partError } = await supabase
      .from('customer_quests')
      .select('model_id, status');

    const activeCounts: Record<string, number> = {};
    const completedCounts: Record<string, number> = {};

    if (!partError && participations) {
      participations.forEach((p) => {
        if (p.status === 'em_andamento') {
          activeCounts[p.model_id] = (activeCounts[p.model_id] || 0) + 1;
        } else if (p.status === 'concluida') {
          completedCounts[p.model_id] = (completedCounts[p.model_id] || 0) + 1;
        }
      });
    }

    return (modelsData || []).map((row) => ({
      ...mapModel(row),
      activeParticipantsCount: activeCounts[row.id] || 0,
      completedParticipantsCount: completedCounts[row.id] || 0,
    }));
  },

  async getModelById(id: string): Promise<QuestModel | null> {
    const { data, error } = await supabase
      .from('quest_models')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar modelo Quest ${id}:`, error);
      throw new Error(error.message);
    }

    return data ? mapModel(data) : null;
  },

  async createModel(data: {
    name: string;
    description?: string;
    imageUrl?: string;
    piecesCount: number;
    level: number;
    minValue?: number;
    assemblyInstructions?: string;
    isActive?: boolean;
  }): Promise<QuestModel> {
    if (!data.name?.trim()) throw new Error('O nome do modelo Quest é obrigatório.');
    if (!data.piecesCount || data.piecesCount < 1) throw new Error('A quantidade de peças deve ser maior que zero.');
    if (!data.level || data.level < 1 || data.level > 5) throw new Error('O nível deve estar entre 1 e 5.');

    const { data: created, error } = await supabase
      .from('quest_models')
      .insert({
        name: data.name.trim(),
        description: data.description?.trim() || '',
        image_url: data.imageUrl?.trim() || '',
        pieces_count: Math.floor(data.piecesCount),
        level: Math.floor(data.level),
        min_value: data.minValue !== undefined ? Number(data.minValue) : 100.0,
        assembly_instructions: data.assemblyInstructions?.trim() || '',
        is_active: data.isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar modelo Quest:', error);
      throw new Error(error.message);
    }

    return mapModel(created);
  },

  async updateModel(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      imageUrl: string;
      piecesCount: number;
      level: number;
      minValue: number;
      assemblyInstructions: string;
      isActive: boolean;
    }>
  ): Promise<QuestModel> {
    // REGRA IMPORTANTE: Se a quantidade de peças for alterada, verificar se já existem participantes
    if (data.piecesCount !== undefined) {
      const current = await this.getModelById(id);
      if (current && current.piecesCount !== data.piecesCount) {
        const { count, error: countErr } = await supabase
          .from('customer_quests')
          .select('*', { count: 'exact', head: true })
          .eq('model_id', id);

        if (!countErr && count && count > 0) {
          throw new Error(
            `Não é possível alterar a quantidade de peças deste modelo (${current.piecesCount} peças) porque já existem ${count} cliente(s) vinculados a ele. Isso invalidaria o progresso histórico dos participantes. Crie um novo modelo se desejar uma quantidade diferente.`
          );
        }
      }
    }

    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.description !== undefined) payload.description = data.description.trim();
    if (data.imageUrl !== undefined) payload.image_url = data.imageUrl.trim();
    if (data.piecesCount !== undefined) payload.pieces_count = Math.floor(data.piecesCount);
    if (data.level !== undefined) payload.level = Math.floor(data.level);
    if (data.minValue !== undefined) payload.min_value = Number(data.minValue);
    if (data.assemblyInstructions !== undefined) payload.assembly_instructions = data.assemblyInstructions.trim();
    if (data.isActive !== undefined) payload.is_active = data.isActive;

    const { data: updated, error } = await supabase
      .from('quest_models')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao atualizar modelo Quest ${id}:`, error);
      throw new Error(error.message);
    }

    return mapModel(updated);
  },

  async toggleModelActive(id: string, currentStatus: boolean): Promise<QuestModel> {
    return this.updateModel(id, { isActive: !currentStatus });
  },

  // =========================================================================
  // NÍVEL E PROGRESSO DO CLIENTE (customer_quest_progress)
  // =========================================================================

  async getCustomerProgress(customerId: string): Promise<CustomerQuestProgress> {
    const { data, error } = await supabase
      .from('customer_quest_progress')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar progresso do cliente ${customerId}:`, error);
      throw new Error(error.message);
    }

    if (data) {
      return {
        customerId: data.customer_id,
        currentLevel: Number(data.current_level) || 1,
        totalQuestsCompleted: Number(data.total_quests_completed) || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }

    // Se o cliente ainda não possuir registro, provisiona no Nível 1
    const { data: created, error: insertErr } = await supabase
      .from('customer_quest_progress')
      .insert({
        customer_id: customerId,
        current_level: 1,
        total_quests_completed: 0,
      })
      .select()
      .single();

    if (insertErr || !created) {
      // Retorna nível 1 padrão caso ocorra conflito
      return {
        customerId,
        currentLevel: 1,
        totalQuestsCompleted: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      customerId: created.customer_id,
      currentLevel: Number(created.current_level) || 1,
      totalQuestsCompleted: Number(created.total_quests_completed) || 0,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  },

  // =========================================================================
  // PARTICIPAÇÕES DOS CLIENTES (customer_quests)
  // =========================================================================

  /**
   * Retorna a Quest em andamento do cliente, ou null se não houver
   */
  async getActiveCustomerQuest(customerId: string): Promise<CustomerQuest | null> {
    const { data, error } = await supabase
      .from('customer_quests')
      .select('*, quest_models (*), quest_steps (*, quest_closures (*))')
      .eq('customer_id', customerId)
      .eq('status', 'em_andamento')
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar Quest em andamento:', error);
      throw new Error(error.message);
    }

    return data ? mapCustomerQuest(data) : null;
  },

  /**
   * Retorna o histórico de Quests concluídas ou canceladas do cliente
   */
  async getCustomerQuestHistory(customerId: string): Promise<CustomerQuest[]> {
    const { data, error } = await supabase
      .from('customer_quests')
      .select('*, quest_models (*), quest_steps (*)')
      .eq('customer_id', customerId)
      .neq('status', 'em_andamento')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar histórico de Quests do cliente:', error);
      throw new Error(error.message);
    }

    return (data || []).map(mapCustomerQuest);
  },

  /**
   * Inicia uma nova Quest para o cliente respeitando a modalidade e nível
   */
  async startCustomerQuest(data: {
    customerId: string;
    modelId: string;
    modality: QuestModality;
  }): Promise<CustomerQuest> {
    // 1. Garantir que não existe Quest em andamento
    const active = await this.getActiveCustomerQuest(data.customerId);
    if (active) {
      throw new Error(
        `O cliente já possui a Quest "${active.model?.name || 'em andamento'}" ativa. Conclua ou cancele a participação atual antes de iniciar outra.`
      );
    }

    // 2. Verificar modelo e disponibilidade
    const model = await this.getModelById(data.modelId);
    if (!model) throw new Error('Modelo Quest não encontrado.');
    if (!model.isActive) {
      throw new Error('Este modelo Quest está desabilitado e não pode receber novas vinculações.');
    }

    // 3. Obter progresso atual do cliente
    const progress = await this.getCustomerProgress(data.customerId);

    // 4. Validar regra da modalidade
    if (data.modality === 'jornada') {
      if (model.level !== progress.currentLevel) {
        throw new Error(
          `Na Jornada TRIGON, um cliente de Nível ${progress.currentLevel} só pode iniciar modelos de Nível ${progress.currentLevel}. O modelo selecionado é de Nível ${model.level}. Use a modalidade "Quest Livre" se desejar liberar este modelo excepcionalmente.`
        );
      }
    }

    // 5. Inserir participação
    const { data: created, error } = await supabase
      .from('customer_quests')
      .insert({
        customer_id: data.customerId,
        model_id: data.modelId,
        modality: data.modality,
        status: 'em_andamento',
        started_level: progress.currentLevel,
      })
      .select('*, quest_models (*)')
      .single();

    if (error) {
      console.error('Erro ao iniciar Quest:', error);
      throw new Error(error.message);
    }

    return mapCustomerQuest(created);
  },

  /**
   * Cancela uma Quest em andamento com justificativa obrigatória
   */
  async cancelCustomerQuest(questId: string, reason: string): Promise<CustomerQuest> {
    if (!reason?.trim()) {
      throw new Error('É obrigatório informar o motivo do cancelamento da Quest.');
    }

    const { data: updated, error } = await supabase
      .from('customer_quests')
      .update({
        status: 'cancelada',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', questId)
      .select('*, quest_models (*), quest_steps (*)')
      .single();

    if (error) {
      console.error('Erro ao cancelar Quest:', error);
      throw new Error(error.message);
    }

    // Registrar log de auditoria
    await supabase.from('quest_audit_logs').insert({
      customer_quest_id: questId,
      action: 'CANCELAMENTO_QUEST',
      reason: reason.trim(),
      metadata: { cancelled_at: new Date().toISOString() },
    });

    return mapCustomerQuest(updated);
  },

  // =========================================================================
  // FECHAMENTOS DE COMPRAS (quest_closures)
  // =========================================================================

  async getCustomerClosures(customerId: string, unusedOnly: boolean = false): Promise<QuestClosure[]> {
    let query = supabase
      .from('quest_closures')
      .select('*')
      .eq('customer_id', customerId)
      .order('closure_date', { ascending: false });

    if (unusedOnly) {
      query = query.eq('is_used', false);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar fechamentos do cliente:', error);
      throw new Error(error.message);
    }

    return (data || []).map(mapClosure);
  },

  async createClosure(data: {
    customerId: string;
    totalValue: number;
    closureDate?: string;
    saleReference?: string;
    notes?: string;
  }): Promise<QuestClosure> {
    if (data.totalValue < 100.0) {
      throw new Error('O fechamento deve ter valor mínimo de R$ 100,00 para ser elegível à conquista de peça.');
    }

    const { data: created, error } = await supabase
      .from('quest_closures')
      .insert({
        customer_id: data.customerId,
        total_value: Number(data.totalValue),
        closure_date: data.closureDate ? parseSaoPauloDateTime(data.closureDate) : new Date().toISOString(),
        sale_reference: data.saleReference?.trim() || '',
        notes: data.notes?.trim() || '',
        is_used: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao registrar fechamento:', error);
      throw new Error(error.message);
    }

    return mapClosure(created);
  },

  // =========================================================================
  // ETAPAS E PEÇAS (quest_steps)
  // =========================================================================

  /**
   * Verifica se já existe uma peça com o mesmo nome na participação
   */
  async checkDuplicatePiece(
    customerQuestId: string,
    pieceName: string
  ): Promise<{ hasDuplicate: boolean; existingStep?: QuestStep }> {
    const normalized = normalizePieceName(pieceName);
    const { data, error } = await supabase
      .from('quest_steps')
      .select('*')
      .eq('customer_quest_id', customerQuestId)
      .eq('normalized_piece_name', normalized)
      .neq('status', 'cancelada')
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar duplicidade de peça:', error);
      return { hasDuplicate: false };
    }

    return {
      hasDuplicate: !!data,
      existingStep: data ? mapStep(data) : undefined,
    };
  },

  /**
   * Registra uma nova peça/etapa para a Quest em andamento
   */
  async addQuestStep(data: {
    customerQuestId: string;
    pieceName: string;
    status: QuestStepStatus;
    closureId?: string | null;
    notes?: string;
    isException?: boolean;
    exceptionReason?: string;
    date?: string;
  }): Promise<{ step: QuestStep; completionResult?: any }> {
    if (!data.pieceName?.trim()) {
      throw new Error('O nome da peça é obrigatório.');
    }

    // 1. Buscar a Quest ativa e o modelo
    const { data: questData, error: questErr } = await supabase
      .from('customer_quests')
      .select('*, quest_models (*), quest_steps (*)')
      .eq('id', data.customerQuestId)
      .single();

    if (questErr || !questData) {
      throw new Error('Quest ativa não encontrada.');
    }
    if (questData.status !== 'em_andamento') {
      throw new Error('Não é possível adicionar peças a uma Quest concluída ou cancelada.');
    }

    const currentSteps: any[] = (questData.quest_steps || []).filter((s: any) => s.status !== 'cancelada');
    const totalAllowedPieces: number = questData.quest_models?.pieces_count || 5;

    // REGRA: O progresso não pode ultrapassar o limite de peças do modelo
    if (currentSteps.length >= totalAllowedPieces) {
      throw new Error(
        `Limite de peças atingido! Este modelo é composto por ${totalAllowedPieces} peças e todas as etapas já foram registradas.`
      );
    }

    // 2. Validação de peça repetida
    const normalized = normalizePieceName(data.pieceName);
    const duplicate = currentSteps.find((s: any) => s.normalized_piece_name === normalized);

    if (duplicate && !data.isException) {
      throw new Error(
        `A peça "${data.pieceName}" já foi registrada nesta participação (Etapa ${duplicate.step_number}, Situação: ${duplicate.status}). Marque a confirmação de exceção se desejar incluir mesmo assim.`
      );
    }

    if (duplicate && data.isException && !data.exceptionReason?.trim()) {
      throw new Error('A justificativa administrativa é obrigatória para registrar uma peça duplicada.');
    }

    // 3. Se houver fechamento associado, validar e marcar como utilizado
    if (data.closureId) {
      const { data: closureData, error: clErr } = await supabase
        .from('quest_closures')
        .select('*')
        .eq('id', data.closureId)
        .single();

      if (clErr || !closureData) throw new Error('Fechamento não encontrado.');
      if (closureData.is_used) {
        throw new Error('Este fechamento já foi utilizado em outra conquista e não pode ser reutilizado.');
      }

      await supabase
        .from('quest_closures')
        .update({ is_used: true, updated_at: new Date().toISOString() })
        .eq('id', data.closureId);
    }

    // 4. Inserir a nova etapa
    const stepNumber = currentSteps.length + 1;
    const effectiveDate = data.date ? parseSaoPauloDateTime(data.date) : new Date().toISOString();

    const payload: any = {
      customer_quest_id: data.customerQuestId,
      step_number: stepNumber,
      piece_name: data.pieceName.trim(),
      normalized_piece_name: normalized,
      status: data.status,
      closure_id: data.closureId || null,
      notes: data.notes?.trim() || '',
      earned_at: effectiveDate,
      reserved_at: data.status === 'reservada' || data.status === 'enviada' ? effectiveDate : null,
      sent_at: data.status === 'enviada' ? effectiveDate : null,
      is_exception: data.isException ?? false,
      exception_reason: data.exceptionReason?.trim() || '',
    };

    const { data: created, error: stepError } = await supabase
      .from('quest_steps')
      .insert(payload)
      .select('*, quest_closures (*)')
      .single();

    if (stepError) {
      console.error('Erro ao adicionar etapa:', stepError);
      throw new Error(stepError.message);
    }

    // Registrar log se for exceção
    if (data.isException) {
      await supabase.from('quest_audit_logs').insert({
        customer_quest_id: data.customerQuestId,
        step_id: created.id,
        action: 'REGISTRO_PECA_DUPLICADA_EXCECAO',
        reason: data.exceptionReason?.trim() || 'Exceção confirmada pelo administrador',
        metadata: { piece_name: data.pieceName, step_number: stepNumber },
      });
    }

    // 5. Verificar se atingiu todos os requisitos de conclusão (todas enviadas)
    let completionResult: any = null;
    if (data.status === 'enviada') {
      completionResult = await this.checkAndCompleteQuest(data.customerQuestId);
    }

    return { step: mapStep(created), completionResult };
  },

  /**
   * Atualiza a situação de uma peça existente (ex: Conquistada -> Reservada -> Enviada)
   */
  async updateQuestStepStatus(
    stepId: string,
    newStatus: QuestStepStatus,
    date?: string
  ): Promise<{ step: QuestStep; completionResult?: any }> {
    const effectiveDate = date ? parseSaoPauloDateTime(date) : new Date().toISOString();

    const payload: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'reservada') {
      payload.reserved_at = effectiveDate;
    } else if (newStatus === 'enviada') {
      payload.sent_at = effectiveDate;
    }

    const { data: updated, error } = await supabase
      .from('quest_steps')
      .update(payload)
      .eq('id', stepId)
      .select('*, quest_closures (*)')
      .single();

    if (error) {
      console.error('Erro ao atualizar etapa:', error);
      throw new Error(error.message);
    }

    // Se a peça foi marcada como enviada, dispara a verificação transacional de conclusão
    let completionResult: any = null;
    if (newStatus === 'enviada' && updated.customer_quest_id) {
      completionResult = await this.checkAndCompleteQuest(updated.customer_quest_id);
    }

    return { step: mapStep(updated), completionResult };
  },

  /**
   * Cancela uma etapa lançada incorretamente
   */
  async cancelQuestStep(stepId: string, reason: string): Promise<QuestStep> {
    if (!reason?.trim()) {
      throw new Error('Informe o motivo do cancelamento da etapa.');
    }

    const { data: currentStep, error: fetchErr } = await supabase
      .from('quest_steps')
      .select('*')
      .eq('id', stepId)
      .single();

    if (fetchErr || !currentStep) throw new Error('Etapa não encontrada.');

    // Se estava associada a um fechamento, liberar o fechamento
    if (currentStep.closure_id) {
      await supabase
        .from('quest_closures')
        .update({ is_used: false, updated_at: new Date().toISOString() })
        .eq('id', currentStep.closure_id);
    }

    const { data: updated, error } = await supabase
      .from('quest_steps')
      .update({
        status: 'cancelada',
        notes: currentStep.notes ? `${currentStep.notes} (Cancelada: ${reason.trim()})` : `Cancelada: ${reason.trim()}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stepId)
      .select('*, quest_closures (*)')
      .single();

    if (error) {
      console.error('Erro ao cancelar etapa:', error);
      throw new Error(error.message);
    }

    // Registrar log de auditoria
    await supabase.from('quest_audit_logs').insert({
      customer_quest_id: currentStep.customer_quest_id,
      step_id: stepId,
      action: 'CANCELAMENTO_ETAPA',
      reason: reason.trim(),
      metadata: { previous_status: currentStep.status, piece_name: currentStep.piece_name },
    });

    return mapStep(updated);
  },

  /**
   * Executa a rotina transacional de conclusão no Supabase (se todas as peças foram enviadas)
   */
  async checkAndCompleteQuest(customerQuestId: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('check_and_complete_quest', {
        p_customer_quest_id: customerQuestId,
      });

      if (error) {
        console.warn('Erro ao chamar RPC check_and_complete_quest, executando verificação via cliente:', error);
        return await this.fallbackCompleteQuest(customerQuestId);
      }

      return data;
    } catch (err) {
      console.warn('Fallback para conclusão de Quest no frontend:', err);
      return await this.fallbackCompleteQuest(customerQuestId);
    }
  },

  /**
   * Fallback de conclusão atômica no cliente caso a RPC não tenha sido executada no banco ainda
   */
  async fallbackCompleteQuest(customerQuestId: string): Promise<any> {
    const { data: quest, error: qErr } = await supabase
      .from('customer_quests')
      .select('*, quest_models (*), quest_steps (*)')
      .eq('id', customerQuestId)
      .single();

    if (qErr || !quest || quest.status !== 'em_andamento') return { completed: false };

    const total = quest.quest_models?.pieces_count || 5;
    const sentCount = (quest.quest_steps || []).filter((s: any) => s.status === 'enviada').length;

    // REGRA CRÍTICA: Somente quando TODAS estiverem enviadas
    if (sentCount >= total) {
      await supabase
        .from('customer_quests')
        .update({
          status: 'concluida',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerQuestId);

      const progress = await this.getCustomerProgress(quest.customer_id);
      const newLevel = Math.min(5, progress.currentLevel + 1);

      await supabase
        .from('customer_quest_progress')
        .update({
          current_level: newLevel,
          total_quests_completed: progress.totalQuestsCompleted + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('customer_id', quest.customer_id);

      return {
        success: true,
        completed: true,
        previous_level: progress.currentLevel,
        new_level: newLevel,
        total_pieces: total,
      };
    }

    return { completed: false, sent_pieces: sentCount, total_pieces: total };
  },
};
