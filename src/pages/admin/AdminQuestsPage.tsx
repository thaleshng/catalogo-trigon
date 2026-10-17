import React, { useEffect, useState } from 'react';
import { QuestModel } from '../../types';
import { questService } from '../../services/questService';
import { useToast } from '../../components/common/Toast';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ImageUploader } from '../../components/common/ImageUploader';
import {
  Compass,
  Plus,
  Search,
  Edit2,
  Trophy,
  ToggleLeft,
  ToggleRight,
  Layers,
  Users,
  DollarSign,
} from 'lucide-react';

export const AdminQuestsPage: React.FC = () => {
  const [models, setModels] = useState<QuestModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal Form State (Create / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<QuestModel | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const emptyForm = {
    name: '',
    description: '',
    imageUrl: '',
    piecesCount: 5,
    level: 1,
    minValue: 100,
    assemblyInstructions: '',
    isActive: true,
  };
  const [formData, setFormData] = useState(emptyForm);

  const { success, error, info } = useToast();

  const loadModels = async () => {
    try {
      setLoading(true);
      const data = await questService.getModels();
      setModels(data);
    } catch (err: any) {
      console.error(err);
      error('Falha ao carregar modelos Quest.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleOpenCreate = () => {
    setEditingModel(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (model: QuestModel) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      description: model.description || '',
      imageUrl: model.imageUrl || '',
      piecesCount: model.piecesCount,
      level: model.level,
      minValue: model.minValue,
      assemblyInstructions: model.assemblyInstructions || '',
      isActive: model.isActive,
    });
    setIsFormOpen(true);
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      info('O nome do modelo Quest é obrigatório.');
      return;
    }

    try {
      setIsSaving(true);
      if (editingModel) {
        await questService.updateModel(editingModel.id, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          imageUrl: formData.imageUrl.trim(),
          piecesCount: Number(formData.piecesCount),
          level: Number(formData.level),
          minValue: Number(formData.minValue),
          assemblyInstructions: formData.assemblyInstructions.trim(),
          isActive: formData.isActive,
        });
        success(`Modelo Quest "${formData.name}" atualizado com sucesso!`);
      } else {
        await questService.createModel({
          name: formData.name.trim(),
          description: formData.description.trim(),
          imageUrl: formData.imageUrl.trim(),
          piecesCount: Number(formData.piecesCount),
          level: Number(formData.level),
          minValue: Number(formData.minValue),
          assemblyInstructions: formData.assemblyInstructions.trim(),
          isActive: formData.isActive,
        });
        success(`Modelo Quest "${formData.name}" cadastrado com sucesso!`);
      }

      setIsFormOpen(false);
      setEditingModel(null);
      await loadModels();
    } catch (err: any) {
      console.error(err);
      error(err.message || 'Erro ao salvar modelo Quest.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (model: QuestModel) => {
    try {
      const updated = await questService.toggleModelActive(model.id, model.isActive);
      setModels((prev) => prev.map((m) => (m.id === model.id ? updated : m)));
      success(
        `Modelo "${model.name}" ${updated.isActive ? 'habilitado' : 'desabilitado'} para novas vinculações.`
      );
    } catch (err: any) {
      error(err.message || 'Erro ao alternar disponibilidade do modelo.');
    }
  };

  // Filtragem
  const filteredModels = models.filter((model) => {
    const matchesSearch =
      model.name.toLowerCase().includes(search.toLowerCase().trim()) ||
      (model.description && model.description.toLowerCase().includes(search.toLowerCase().trim()));

    if (!matchesSearch) return false;

    if (selectedLevel !== 'all' && model.level !== selectedLevel) return false;

    if (filterActive === 'active') return model.isActive;
    if (filterActive === 'inactive') return !model.isActive;

    return true;
  });

  const totalActiveQuests = models.reduce((acc, m) => acc + (m.activeParticipantsCount || 0), 0);
  const totalCompletedQuests = models.reduce((acc, m) => acc + (m.completedParticipantsCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Ação de Cadastro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide flex items-center gap-2.5">
            <Compass className="w-7 h-7 text-crimson-500" />
            <span>Quest TRIGON — Modelos Colecionáveis</span>
          </h1>
          <p className="text-sm text-trigon-400 mt-1">
            Gestão dos modelos de fidelidade, níveis da Jornada TRIGON e conquistas por compras
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenCreate}
          icon={<Plus className="w-4 h-4" />}
        >
          Novo Modelo Quest
        </Button>
      </div>

      {/* KPI Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-trigon-900/70 border border-trigon-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-trigon-400">Modelos Cadastrados</p>
            <p className="text-2xl font-bold text-white font-mono mt-1">{models.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-trigon-800/80 flex items-center justify-center text-crimson-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-trigon-900/70 border border-trigon-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-sky-400">Participantes Ativos</p>
            <p className="text-2xl font-bold text-sky-300 font-mono mt-1">{totalActiveQuests}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-950/60 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-trigon-900/70 border border-trigon-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-emerald-400">Quests Concluídas</p>
            <p className="text-2xl font-bold text-emerald-300 font-mono mt-1">{totalCompletedQuests}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Trophy className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-trigon-900/70 border border-trigon-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-amber-400">Regra de Fechamento</p>
            <p className="text-xl font-bold text-amber-300 font-mono mt-1">Mín. R$ 100</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-trigon-900/60 p-4 rounded-2xl border border-trigon-800">
        <div className="relative flex-1 lg:max-w-md">
          <Search className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar modelo por nome ou descrição..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 placeholder-trigon-600"
          />
        </div>

        {/* Filtro por Nível */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-xs text-trigon-400 font-semibold uppercase mr-1 hidden sm:inline">
            Nível:
          </span>
          <button
            type="button"
            onClick={() => setSelectedLevel('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              selectedLevel === 'all'
                ? 'bg-crimson-950/80 text-white border border-crimson-600/50'
                : 'text-trigon-400 hover:text-white bg-trigon-950 border border-trigon-800'
            }`}
          >
            Todos
          </button>
          {[1, 2, 3, 4, 5].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedLevel === lvl
                  ? 'bg-crimson-950/80 text-white border border-crimson-600/50'
                  : 'text-trigon-400 hover:text-white bg-trigon-950 border border-trigon-800'
              }`}
            >
              Nv. {lvl}
            </button>
          ))}
        </div>

        {/* Filtro por Status */}
        <div className="flex items-center gap-1 bg-trigon-950 p-1 rounded-xl border border-trigon-800 shrink-0">
          <button
            type="button"
            onClick={() => setFilterActive('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
              filterActive === 'all' ? 'bg-trigon-800 text-white' : 'text-trigon-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setFilterActive('active')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
              filterActive === 'active' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40' : 'text-trigon-400 hover:text-white'
            }`}
          >
            Ativos
          </button>
          <button
            type="button"
            onClick={() => setFilterActive('inactive')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
              filterActive === 'inactive' ? 'bg-trigon-800 text-trigon-300' : 'text-trigon-400 hover:text-white'
            }`}
          >
            Pausados
          </button>
        </div>
      </div>

      {/* Grid de Modelos Quest */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl bg-trigon-900/40 animate-pulse border border-trigon-800"
            />
          ))}
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="text-center py-16 bg-trigon-900/40 rounded-2xl border border-trigon-800 p-8 space-y-3">
          <Compass className="w-12 h-12 text-trigon-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhum modelo Quest encontrado</h3>
          <p className="text-sm text-trigon-400 max-w-sm mx-auto">
            {search || selectedLevel !== 'all' || filterActive !== 'all'
              ? 'Tente ajustar os filtros ou a busca digitada acima.'
              : 'Cadastre o primeiro modelo colecionável da Jornada TRIGON clicando no botão acima.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              className={`rounded-2xl border transition-all flex flex-col overflow-hidden ${
                model.isActive
                  ? 'bg-trigon-900/90 border-trigon-800 hover:border-crimson-600/50 shadow-lg'
                  : 'bg-trigon-950/60 border-trigon-850 opacity-75'
              }`}
            >
              {/* Imagem do Modelo com Overlay */}
              <div className="relative h-44 bg-trigon-950 overflow-hidden flex items-center justify-center">
                {model.imageUrl ? (
                  <img
                    src={model.imageUrl}
                    alt={model.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <Trophy className="w-12 h-12 text-trigon-700" />
                )}

                {/* Badges Flutuantes */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <Badge variant="crimson" size="sm">
                    Nível {model.level}
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    {model.piecesCount} Peças
                  </Badge>
                </div>

                <div className="absolute top-3 right-3">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(model)}
                    className="p-1 rounded-full bg-black/70 backdrop-blur-md text-white transition-all shadow"
                    title={model.isActive ? 'Clique para desabilitar' : 'Clique para habilitar'}
                  >
                    {model.isActive ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-trigon-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Informações do Modelo */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">{model.name}</h3>
                  <p className="text-xs text-trigon-400 mt-1 line-clamp-2">
                    {model.description || 'Sem descrição cadastrada.'}
                  </p>
                </div>

                {/* Estatísticas de Participação */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-trigon-800/80 text-center">
                  <div className="p-2 rounded-xl bg-trigon-950/80 border border-trigon-800">
                    <span className="block text-sm font-bold text-sky-400 font-mono">
                      {model.activeParticipantsCount || 0}
                    </span>
                    <span className="text-[10px] text-trigon-400 uppercase">Em Andamento</span>
                  </div>
                  <div className="p-2 rounded-xl bg-trigon-950/80 border border-trigon-800">
                    <span className="block text-sm font-bold text-emerald-400 font-mono">
                      {model.completedParticipantsCount || 0}
                    </span>
                    <span className="text-[10px] text-trigon-400 uppercase">Concluídas</span>
                  </div>
                </div>

                {/* Rodapé do Card */}
                <div className="flex items-center justify-between pt-2 border-t border-trigon-800/80 text-xs">
                  <span className="text-trigon-400 font-mono">
                    Mínimo: {formatCurrency(model.minValue)}
                  </span>

                  <button
                    onClick={() => handleOpenEdit(model)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-trigon-750 text-trigon-300 hover:text-white hover:bg-trigon-800 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Cadastro / Edição de Modelo Quest */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingModel ? 'Editar Modelo Quest' : 'Novo Modelo Quest'}
        description="Cadastre as características do modelo colecionável, quantidade de peças e nível"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveModel} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="flex items-center text-xs font-semibold text-trigon-300 h-5">
              Nome do Modelo Colecionável <span className="text-crimson-400 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Charizard Clássico 3D, Mewtwo Armored, Rayquaza VMAX..."
              required
              className="w-full h-10 px-3.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Nível (1 a 5) */}
            <div className="space-y-1.5">
              <label className="flex items-center text-xs font-semibold text-trigon-300 h-5 whitespace-nowrap">
                Nível da Jornada <span className="text-crimson-400 ml-1">*</span>
              </label>
              <select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
                className="w-full h-10 px-3 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 transition-colors"
              >
                <option value={1}>Nível 1 (Iniciante)</option>
                <option value={2}>Nível 2 (Intermediário)</option>
                <option value={3}>Nível 3 (Avançado)</option>
                <option value={4}>Nível 4 (Veterano)</option>
                <option value={5}>Nível 5 (Mestre Lendário)</option>
              </select>
            </div>

            {/* Quantidade de Peças */}
            <div className="space-y-1.5">
              <label className="flex items-center text-xs font-semibold text-trigon-300 h-5 whitespace-nowrap">
                Qtd. de Peças <span className="text-crimson-400 ml-1">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.piecesCount}
                onChange={(e) => setFormData({ ...formData, piecesCount: Number(e.target.value) })}
                required
                className="w-full h-10 px-3 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 transition-colors"
              />
            </div>

            {/* Valor Mínimo por Conquista */}
            <div className="space-y-1.5">
              <label className="flex items-center text-xs font-semibold text-trigon-300 h-5 whitespace-nowrap">
                Valor Mínimo (R$) <span className="text-crimson-400 ml-1">*</span>
              </label>
              <input
                type="number"
                min="100"
                step="10"
                value={formData.minValue}
                onChange={(e) => setFormData({ ...formData, minValue: Number(e.target.value) })}
                required
                className="w-full h-10 px-3 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 transition-colors"
              />
            </div>
          </div>

          {/* Imagem do Modelo */}
          <div className="space-y-1.5">
            <ImageUploader
              images={formData.imageUrl ? [formData.imageUrl] : []}
              onChange={(imgs) => setFormData({ ...formData, imageUrl: imgs[0] || '' })}
              multiple={false}
              maxImages={1}
              label="Foto do Modelo Completo (opcional)"
              folder="quests"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-trigon-300">
              Descrição do Modelo (opcional)
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes sobre a escultura, acabamento, material ou raridade..."
              className="w-full px-3.5 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 resize-none"
            />
          </div>

          {/* Instruções de Montagem */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-trigon-300">
              Instruções de Montagem (opcional)
            </label>
            <textarea
              rows={2}
              value={formData.assemblyInstructions}
              onChange={(e) => setFormData({ ...formData, assemblyInstructions: e.target.value })}
              placeholder="Ordem recomendada de encaixe, uso de suportes ou pinos..."
              className="w-full px-3.5 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 resize-none"
            />
          </div>

          {/* Disponibilidade Manual */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-trigon-950 border border-trigon-800">
            <div>
              <p className="text-xs font-semibold text-white">Disponível para novas vinculações</p>
              <p className="text-[11px] text-trigon-400 mt-0.5">
                Se desabilitado, os clientes que já iniciaram continuam normalmente, mas nenhum novo cliente poderá iniciar este modelo
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              className="text-trigon-300 hover:text-white transition-colors"
            >
              {formData.isActive ? (
                <ToggleRight className="w-7 h-7 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-trigon-600" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-trigon-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsFormOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={isSaving}>
              {editingModel ? 'Salvar Alterações' : 'Cadastrar Modelo'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
