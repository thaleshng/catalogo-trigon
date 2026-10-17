import React, { useEffect, useState } from 'react';
import { Gift } from '../../types';
import { giftService } from '../../services/giftService';
import { useToast } from '../../components/common/Toast';
import { formatDateTime } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ImageUploader } from '../../components/common/ImageUploader';
import {
  Gift as GiftIcon,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Package,
} from 'lucide-react';

export const AdminGiftsPage: React.FC = () => {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAvailability, setFilterAvailability] = useState<'all' | 'available' | 'unavailable'>('all');

  // Modal Form State (Create / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<Gift | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const emptyForm = {
    name: '',
    description: '',
    imageUrl: '',
    isAvailable: true,
  };
  const [formData, setFormData] = useState(emptyForm);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Gift | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { success, error, info } = useToast();

  const loadGifts = async () => {
    try {
      setLoading(true);
      const data = await giftService.getGifts();
      setGifts(data);
    } catch (err: any) {
      console.error(err);
      error('Falha ao carregar lista de brindes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGifts();
  }, []);

  const handleOpenCreate = () => {
    setEditingGift(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (gift: Gift) => {
    setEditingGift(gift);
    setFormData({
      name: gift.name,
      description: gift.description || '',
      imageUrl: gift.imageUrl || '',
      isAvailable: gift.isAvailable,
    });
    setIsFormOpen(true);
  };

  const handleSaveGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      info('O nome do brinde é obrigatório.');
      return;
    }

    try {
      setIsSaving(true);
      if (editingGift) {
        await giftService.updateGift(editingGift.id, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          imageUrl: formData.imageUrl.trim(),
          isAvailable: formData.isAvailable,
        });
        success(`Brinde "${formData.name}" atualizado com sucesso!`);
      } else {
        await giftService.createGift({
          name: formData.name.trim(),
          description: formData.description.trim(),
          imageUrl: formData.imageUrl.trim(),
          isAvailable: formData.isAvailable,
        });
        success(`Brinde "${formData.name}" cadastrado com sucesso!`);
      }

      setIsFormOpen(false);
      setEditingGift(null);
      await loadGifts();
    } catch (err: any) {
      console.error(err);
      error(err.message || 'Erro ao salvar brinde.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAvailability = async (gift: Gift) => {
    try {
      const updated = await giftService.toggleAvailability(gift.id, gift.isAvailable);
      setGifts((prev) =>
        prev.map((g) => (g.id === gift.id ? updated : g))
      );
      success(
        `Brinde "${gift.name}" ${updated.isAvailable ? 'habilitado' : 'desabilitado'} com sucesso.`
      );
    } catch (err: any) {
      error(err.message || 'Erro ao alternar disponibilidade do brinde.');
    }
  };

  const handleRequestDelete = (gift: Gift) => {
    setDeleteTarget(gift);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const result = await giftService.deleteGift(deleteTarget.id);
      if (!result.success) {
        error(result.error || 'Não é possível excluir este brinde.');
        setIsDeleteDialogOpen(false);
        setDeleteTarget(null);
        return;
      }

      success(`Brinde "${deleteTarget.name}" excluído com sucesso!`);
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      await loadGifts();
    } catch (err: any) {
      error(err.message || 'Erro ao excluir brinde.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtragem
  const filteredGifts = gifts.filter((gift) => {
    const matchesSearch =
      gift.name.toLowerCase().includes(search.toLowerCase().trim()) ||
      (gift.description && gift.description.toLowerCase().includes(search.toLowerCase().trim()));

    if (!matchesSearch) return false;

    if (filterAvailability === 'available') return gift.isAvailable;
    if (filterAvailability === 'unavailable') return !gift.isAvailable;
    return true;
  });

  const availableCount = gifts.filter((g) => g.isAvailable).length;
  const unavailableCount = gifts.filter((g) => !g.isAvailable).length;

  return (
    <div className="space-y-6">
      {/* Header & Ação de Cadastro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide flex items-center gap-2.5">
            <GiftIcon className="w-7 h-7 text-crimson-500" />
            <span>Gerenciamento de Brindes</span>
          </h1>
          <p className="text-sm text-trigon-400 mt-1">
            Controle de brindes, disponibilidade manual e mimos para clientes TRIGON
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenCreate}
          icon={<Plus className="w-4 h-4" />}
        >
          Novo Brinde
        </Button>
      </div>

      {/* KPI Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-trigon-900/70 border border-trigon-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-trigon-400">Total de Brindes</p>
            <p className="text-2xl font-bold text-white font-mono mt-1">{gifts.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-trigon-800/80 flex items-center justify-center text-crimson-400">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-trigon-900/70 border border-trigon-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-emerald-400">Disponíveis para Vínculo</p>
            <p className="text-2xl font-bold text-emerald-300 font-mono mt-1">{availableCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-trigon-900/70 border border-trigon-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-trigon-400">Desabilitados / Pausados</p>
            <p className="text-2xl font-bold text-trigon-300 font-mono mt-1">{unavailableCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-trigon-800/80 flex items-center justify-center text-trigon-500">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-trigon-900/60 p-4 rounded-2xl border border-trigon-800">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar brinde por nome ou descrição..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 placeholder-trigon-600"
          />
        </div>

        {/* Botões de Filtro */}
        <div className="flex items-center gap-1.5 bg-trigon-950 p-1 rounded-xl border border-trigon-800">
          <button
            type="button"
            onClick={() => setFilterAvailability('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterAvailability === 'all'
                ? 'bg-crimson-950/80 text-white border border-crimson-600/50'
                : 'text-trigon-400 hover:text-white'
            }`}
          >
            Todos ({gifts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterAvailability('available')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterAvailability === 'available'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/50'
                : 'text-trigon-400 hover:text-white'
            }`}
          >
            Disponíveis ({availableCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterAvailability('unavailable')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterAvailability === 'unavailable'
                ? 'bg-trigon-800 text-trigon-200 border border-trigon-700'
                : 'text-trigon-400 hover:text-white'
            }`}
          >
            Indisponíveis ({unavailableCount})
          </button>
        </div>
      </div>

      {/* Lista / Tabela de Brindes */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-trigon-900/40 animate-pulse border border-trigon-800"
            />
          ))}
        </div>
      ) : filteredGifts.length === 0 ? (
        <div className="text-center py-16 bg-trigon-900/40 rounded-2xl border border-trigon-800 p-8 space-y-3">
          <GiftIcon className="w-12 h-12 text-trigon-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhum brinde encontrado</h3>
          <p className="text-sm text-trigon-400 max-w-sm mx-auto">
            {search || filterAvailability !== 'all'
              ? 'Tente ajustar os filtros ou a busca digitada acima.'
              : 'Cadastre o primeiro brinde da TRIGON clicando no botão "Novo Brinde".'}
          </p>
        </div>
      ) : (
        <div className="bg-trigon-900 border border-trigon-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-trigon-300">
              <thead className="bg-trigon-950/80 text-xs uppercase font-semibold text-trigon-400 border-b border-trigon-800 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Brinde</th>
                  <th className="py-3.5 px-4">Descrição</th>
                  <th className="py-3.5 px-4">Disponibilidade Manual</th>
                  <th className="py-3.5 px-4">Data de Cadastro</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trigon-800/60">
                {filteredGifts.map((gift) => (
                  <tr key={gift.id} className="hover:bg-trigon-800/30 transition-colors">
                    {/* Imagem + Nome */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-trigon-950 border border-trigon-750 flex items-center justify-center overflow-hidden shrink-0">
                          {gift.imageUrl ? (
                            <img
                              src={gift.imageUrl}
                              alt={gift.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <GiftIcon className="w-5 h-5 text-crimson-400" />
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-white block text-sm">
                            {gift.name}
                          </span>
                          <span className="text-[11px] text-trigon-500 font-mono">
                            ID: {gift.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Descrição */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {gift.description ? (
                        <p className="text-xs text-trigon-300 truncate" title={gift.description}>
                          {gift.description}
                        </p>
                      ) : (
                        <span className="text-xs text-trigon-600 italic">Sem descrição</span>
                      )}
                    </td>

                    {/* Disponibilidade / Switch */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(gift)}
                          className="text-trigon-300 hover:text-white transition-colors"
                          title={gift.isAvailable ? 'Clique para desabilitar' : 'Clique para habilitar'}
                        >
                          {gift.isAvailable ? (
                            <ToggleRight className="w-6 h-6 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-trigon-600" />
                          )}
                        </button>
                        <Badge
                          variant={gift.isAvailable ? 'success' : 'neutral'}
                          dot
                        >
                          {gift.isAvailable ? 'Habilitado' : 'Desabilitado'}
                        </Badge>
                      </div>
                    </td>

                    {/* Data de Criação */}
                    <td className="py-3.5 px-4 text-xs text-trigon-400 font-mono">
                      {formatDateTime(gift.createdAt)}
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(gift)}
                          className="p-1.5 rounded-lg border border-trigon-750 text-trigon-300 hover:text-white hover:bg-trigon-800 transition-colors"
                          title="Editar Brinde"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRequestDelete(gift)}
                          className="p-1.5 rounded-lg border border-crimson-900/40 text-crimson-400 hover:text-crimson-300 hover:bg-crimson-950/40 transition-colors"
                          title="Excluir Brinde"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Cadastro / Edição de Brinde */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingGift ? 'Editar Brinde' : 'Novo Brinde'}
        description="Cadastre brindes para premiar e encantar clientes TRIGON"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveGift} className="space-y-4">
          {/* Nome do Brinde */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-trigon-300">
              Nome do Brinde <span className="text-crimson-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Sleeves Charizard EX, Booster Especial, Pin Trigon..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>

          {/* Imagem do Brinde */}
          <div className="space-y-1.5">
            <ImageUploader
              images={formData.imageUrl ? [formData.imageUrl] : []}
              onChange={(imgs) => setFormData({ ...formData, imageUrl: imgs[0] || '' })}
              multiple={false}
              maxImages={1}
              label="Foto do Brinde (opcional)"
              folder="gifts"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-trigon-300">
              Descrição do Brinde (opcional)
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes sobre o brinde, edição, condições ou brindes especiais..."
              className="w-full px-3.5 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 resize-none"
            />
          </div>

          {/* Disponibilidade Manual */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-trigon-950 border border-trigon-800">
            <div>
              <p className="text-xs font-semibold text-white">Disponível para novos vínculos</p>
              <p className="text-[11px] text-trigon-400 mt-0.5">
                Se desabilitado, o brinde não aparecerá na lista para ser vinculado a clientes
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isAvailable: !formData.isAvailable })}
              className="text-trigon-300 hover:text-white transition-colors"
            >
              {formData.isAvailable ? (
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
            <Button
              type="submit"
              variant="primary"
              loading={isSaving}
            >
              {editingGift ? 'Salvar Alterações' : 'Cadastrar Brinde'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmação de Exclusão de Brinde */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Excluir Brinde"
        message={`Deseja realmente excluir o brinde "${deleteTarget?.name}"? A exclusão só será permitida se o brinde nunca tiver sido vinculado a nenhum cliente.`}
        confirmText="Excluir Brinde"
        loading={isDeleting}
      />
    </div>
  );
};
