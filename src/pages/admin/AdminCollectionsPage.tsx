import React, { useEffect, useRef, useState } from 'react';
import { Collection } from '../../types';
import { collectionService } from '../../services/collectionService';
import { useToast } from '../../components/common/Toast';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ImageUploader } from '../../components/common/ImageUploader';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Search,
  GripVertical,
} from 'lucide-react';

export const AdminCollectionsPage: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(null);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const originalOrderRef = useRef<Collection[] | null>(null);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    coverImage: '',
    isActive: true,
  });

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { success, error } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [cols, counts] = await Promise.all([
        collectionService.getCollections(false),
        collectionService.getCollectionProductCounts(),
      ]);
      setCollections(cols);
      setProductCounts(counts);
    } catch (err) {
      console.error(err);
      error('Falha ao carregar lista de coleções');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingCollection(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      coverImage: 'https://images.unsplash.com/photo-1613770742268-3693246eb77a?q=80&w=1200&auto=format&fit=crop',
      isActive: true,
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (col: Collection) => {
    setEditingCollection(col);
    setFormData({
      name: col.name,
      slug: col.slug,
      description: col.description,
      coverImage: col.coverImage,
      isActive: col.isActive,
    });
    setIsFormOpen(true);
  };

  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      error('O nome da coleção é obrigatório.');
      return;
    }

    try {
      if (editingCollection) {
        await collectionService.updateCollection(editingCollection.id, {
          name: formData.name,
          slug: formData.slug || undefined,
          description: formData.description,
          coverImage: formData.coverImage,
          isActive: formData.isActive,
        });
        success(`Coleção "${formData.name}" atualizada com sucesso!`);
      } else {
        await collectionService.createCollection({
          name: formData.name,
          slug: formData.slug || undefined,
          description: formData.description,
          coverImage: formData.coverImage || 'https://images.unsplash.com/photo-1613770742268-3693246eb77a?q=80&w=1200&auto=format&fit=crop',
          isActive: formData.isActive,
        });
        success(`Coleção "${formData.name}" cadastrada com sucesso!`);
      }
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao salvar coleção');
    }
  };

  const handleToggleVisibility = async (col: Collection) => {
    try {
      const updated = await collectionService.updateCollection(col.id, {
        isActive: !col.isActive,
      });
      setCollections((prev) =>
        prev.map((c) => (c.id === col.id ? updated : c))
      );
      success(
        `Coleção "${col.name}" ${updated.isActive ? 'ativada' : 'ocultada'} no catálogo.`
      );
    } catch (err) {
      error('Erro ao alternar visibilidade da coleção');
    }
  };

  const handleRequestDelete = (col: Collection) => {
    setDeleteTarget(col);
    setDeleteError(null);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const result = await collectionService.deleteCollection(deleteTarget.id);
      if (!result.success) {
        setDeleteError(result.error || 'Não é possível excluir esta coleção.');
        return;
      }

      success(`Coleção "${deleteTarget.name}" excluída com sucesso!`);
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao excluir coleção');
    }
  };

  const filteredCollections = collections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleCollectionDragEnter = (targetId: string) => {
    if (!draggedCollectionId || draggedCollectionId === targetId || search.trim() || isSavingOrder) {
      return;
    }

    setDragOverCollectionId(targetId);
    setCollections((currentCollections) => {
      const sourceIndex = currentCollections.findIndex(
        (collection) => collection.id === draggedCollectionId
      );
      const targetIndex = currentCollections.findIndex(
        (collection) => collection.id === targetId
      );
      if (sourceIndex < 0 || targetIndex < 0) return currentCollections;

      const reordered = [...currentCollections];
      const [movedCollection] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, movedCollection);
      return reordered;
    });
  };

  const handleCollectionDrop = async () => {
    if (!draggedCollectionId || search.trim() || isSavingOrder) return;

    const reordered = collections;
    const originalOrder = originalOrderRef.current;
    if (!originalOrder || reordered.every((collection, index) => collection.id === originalOrder[index]?.id)) {
      setDraggedCollectionId(null);
      setDragOverCollectionId(null);
      return;
    }

    setIsSavingOrder(true);

    try {
      await collectionService.reorderCollections(reordered.map((collection) => collection.id));
      success('Ordem das coleções salva com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar a ordem das coleções:', err);
      setCollections(originalOrder);
      error('Não foi possível salvar a ordem das coleções.');
    } finally {
      setIsSavingOrder(false);
      setDraggedCollectionId(null);
      setDragOverCollectionId(null);
      originalOrderRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
            Gerenciamento de Coleções
          </h1>
          <p className="text-sm text-trigon-400 mt-1">
            Cadastre novas coleções, edite detalhes e controle a visibilidade pública
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenCreate}
          icon={<Plus className="w-4 h-4" />}
        >
          Nova Coleção
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-4 bg-trigon-900/60 p-4 rounded-2xl border border-trigon-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar coleção por nome..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white placeholder-trigon-500 text-sm focus:outline-none focus:border-crimson-500"
          />
        </div>
        <span className="text-xs text-trigon-400">
          Total: <strong className="text-white">{filteredCollections.length}</strong>
        </span>
      </div>
      <p className="text-xs text-trigon-400 -mt-3">
        {search.trim()
          ? 'Limpe a busca para reorganizar as coleções.'
          : isSavingOrder
            ? 'Salvando nova ordem...'
            : 'Segure e arraste uma coleção: a lista se reorganiza na hora e salva ao soltar.'}
      </p>

      {/* Collections List / Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-trigon-900 animate-pulse" />
          ))}
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="text-center py-16 bg-trigon-900/40 rounded-2xl border border-trigon-800 p-8 space-y-3">
          <Layers className="w-12 h-12 text-trigon-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhuma coleção encontrada</h3>
          <p className="text-sm text-trigon-400">
            Cadastre sua primeira coleção usando o botão "Nova Coleção" acima.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCollections.map((col) => {
            const count = productCounts[col.id] || 0;
            return (
              <div
                key={col.id}
                data-collection-card
                onDragEnter={() => handleCollectionDragEnter(col.id)}
                onDragOver={(event) => {
                  if (!search.trim() && !isSavingOrder) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleCollectionDrop();
                }}
                className={`rounded-2xl bg-trigon-900 border border-trigon-800 overflow-hidden flex flex-col justify-between shadow-lg transition-all duration-200 ${
                  draggedCollectionId === col.id
                    ? 'scale-[0.98] opacity-40'
                    : dragOverCollectionId === col.id
                      ? 'scale-[1.02] border-crimson-500 ring-2 ring-crimson-500/50 shadow-glow-crimson'
                      : 'hover:border-trigon-700'
                }`}
              >
                <div>
                  {/* Image banner */}
                  <div className="relative h-44 w-full bg-trigon-950">
                    <img
                      src={col.coverImage}
                      alt={col.name}
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1613770742268-3693246eb77a?q=80&w=1200&auto=format&fit=crop';
                      }}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-trigon-900 via-transparent to-transparent" />

                    {/* Status Badge */}
                    <div className="absolute top-3 left-3">
                      {col.isActive ? (
                        <Badge variant="success" size="sm">
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Oculta
                        </Badge>
                      )}
                    </div>

                    {/* Count Badge */}
                    <div className="absolute top-3 right-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-trigon-950/80 border border-trigon-700 text-trigon-200 backdrop-blur-md">
                        {count} produtos
                      </span>
                    </div>

                    <button
                      type="button"
                      draggable={!search.trim() && !isSavingOrder}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', col.id);
                        const card = event.currentTarget.closest<HTMLElement>('[data-collection-card]');
                        if (card) {
                          event.dataTransfer.setDragImage(
                            card,
                            card.clientWidth / 2,
                            Math.min(60, card.clientHeight / 2)
                          );
                        }
                        originalOrderRef.current = [...collections];
                        setDraggedCollectionId(col.id);
                      }}
                      onDragEnd={() => {
                        setDraggedCollectionId(null);
                        setDragOverCollectionId(null);
                      }}
                      disabled={Boolean(search.trim()) || isSavingOrder}
                      aria-label={`Arrastar ${col.name} para mudar a ordem`}
                      title="Segure e arraste para mudar a ordem"
                      className="absolute bottom-3 right-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-trigon-950/90 border border-trigon-600 text-white text-xs font-semibold shadow-lg backdrop-blur-md hover:border-crimson-400 hover:bg-crimson-950/90 cursor-grab active:cursor-grabbing disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <GripVertical className="w-4 h-4 text-crimson-400" />
                      <span>Segure e arraste</span>
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-2">
                    <h3 className="font-cinzel text-lg font-bold text-white truncate">
                      {col.name}
                    </h3>
                    <p className="text-sm text-trigon-300 line-clamp-2 leading-relaxed pt-1">
                      {col.description}
                    </p>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-trigon-950/60 border-t border-trigon-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleVisibility(col)}
                      className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
                        col.isActive
                          ? 'border-trigon-750 text-trigon-300 hover:text-white hover:bg-trigon-800'
                          : 'border-emerald-600/40 text-emerald-400 hover:bg-emerald-950/40'
                      }`}
                      title={col.isActive ? 'Ocultar Coleção' : 'Ativar Coleção'}
                    >
                      {col.isActive ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={`/colecoes/${col.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg border border-trigon-750 text-trigon-300 hover:text-white hover:bg-trigon-800 transition-colors"
                      title="Abrir no catálogo público"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEdit(col)}
                      icon={<Edit2 className="w-3.5 h-3.5" />}
                    >
                      Editar
                    </Button>
                    <button
                      onClick={() => handleRequestDelete(col)}
                      className="p-2 rounded-lg text-crimson-400 hover:text-crimson-300 hover:bg-crimson-950/40 border border-crimson-900/50 transition-colors"
                      title="Excluir Coleção"
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingCollection ? 'Editar Coleção' : 'Criar Nova Coleção'}
        description="Preencha os dados da coleção para exibição no catálogo da TRIGON"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveCollection} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Nome da Coleção *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Pokémon 30 Anos, Pokémon 151..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Slug da URL (opcional)
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="Deixe em branco para gerar automaticamente a partir do nome"
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-mono text-xs"
            />
          </div>

          <ImageUploader
            images={formData.coverImage ? [formData.coverImage] : []}
            onChange={(imgs) =>
              setFormData({ ...formData, coverImage: imgs[0] || '' })
            }
            multiple={false}
            maxImages={1}
            label="Imagem de Capa da Coleção (Upload com Preview)"
          />

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Descrição
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Breve resumo da coleção..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
              className="w-4 h-4 rounded text-crimson-600 bg-trigon-950 border-trigon-750 focus:ring-crimson-500"
            />
            <label
              htmlFor="isActiveCheck"
              className="text-sm font-medium text-trigon-200 cursor-pointer"
            >
              Exibir coleção publicamente no catálogo
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-trigon-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsFormOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editingCollection ? 'Salvar Alterações' : 'Criar Coleção'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Coleção?"
        message={
          deleteError ||
          `Deseja realmente excluir a coleção "${deleteTarget?.name}"? Esta ação não poderá ser desfeita.`
        }
        confirmText="Sim, excluir"
        variant="danger"
      />
    </div>
  );
};
