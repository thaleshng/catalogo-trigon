import React, { useEffect, useRef, useState } from 'react';
import { Category } from '../../types';
import { categoryService } from '../../services/categoryService';
import { useToast } from '../../components/common/Toast';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ImageUploader } from '../../components/common/ImageUploader';
import {
  Boxes,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Search,
  GripVertical,
} from 'lucide-react';

export const AdminCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const originalOrderRef = useRef<Category[] | null>(null);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    coverImage: '',
    isActive: true,
  });

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { success, error } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [cats, counts] = await Promise.all([
        categoryService.getCategories(false),
        categoryService.getCategoryProductCounts(),
      ]);
      setCategories(cats);
      setProductCounts(counts);
    } catch (err) {
      console.error(err);
      error('Falha ao carregar lista de linhas de produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
      isActive: true,
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      coverImage: cat.coverImage,
      isActive: cat.isActive,
    });
    setIsFormOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      error('O nome da linha de produtos é obrigatório.');
      return;
    }

    try {
      setIsSaving(true);
      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, {
          name: formData.name,
          slug: formData.slug || undefined,
          description: formData.description,
          coverImage: formData.coverImage,
          isActive: formData.isActive,
        });
        success(`Linha "${formData.name}" atualizada com sucesso!`);
      } else {
        await categoryService.createCategory({
          name: formData.name,
          slug: formData.slug || undefined,
          description: formData.description,
          coverImage: formData.coverImage,
          isActive: formData.isActive,
        });
        success(`Linha "${formData.name}" criada com sucesso!`);
      }

      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao salvar linha de produtos');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleVisibility = async (cat: Category) => {
    try {
      const updated = await categoryService.updateCategory(cat.id, {
        isActive: !cat.isActive,
      });
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? updated : c))
      );
      success(
        `Linha "${cat.name}" ${updated.isActive ? 'ativada' : 'desativada'} na vitrine pública.`
      );
    } catch (err) {
      error('Erro ao atualizar visibilidade da linha');
    }
  };

  const handleRequestDelete = (cat: Category) => {
    const count = productCounts[cat.id] || 0;
    if (count > 0) {
      setDeleteError(
        `Não é possível excluir: existem ${count} produto(s) vinculados a esta Linha de Produtos. Transfira ou desvincule os produtos primeiro.`
      );
    } else {
      setDeleteError(null);
    }
    setDeleteTarget(cat);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const res = await categoryService.deleteCategory(deleteTarget.id);
      if (!res.success) {
        error(res.error || 'Erro ao excluir linha de produtos');
        return;
      }
      success(`Linha de produtos "${deleteTarget.name}" excluída!`);
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao excluir linha de produtos');
    }
  };

  // Drag and drop reordering
  const handleDragStart = (id: string) => {
    if (search.trim() || isSavingOrder) return;
    setDraggedCategoryId(id);
    originalOrderRef.current = categories;
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedCategoryId || draggedCategoryId === targetId || search.trim() || isSavingOrder) {
      return;
    }

    setDragOverCategoryId(targetId);
    setCategories((currentCategories) => {
      const sourceIndex = currentCategories.findIndex(
        (cat) => cat.id === draggedCategoryId
      );
      const targetIndex = currentCategories.findIndex(
        (cat) => cat.id === targetId
      );
      if (sourceIndex < 0 || targetIndex < 0) return currentCategories;

      const reordered = [...currentCategories];
      const [movedCat] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, movedCat);
      return reordered;
    });
  };

  const handleDrop = async () => {
    if (!draggedCategoryId || search.trim() || isSavingOrder) return;

    const reordered = categories;
    const originalOrder = originalOrderRef.current;
    if (!originalOrder || reordered.every((cat, index) => cat.id === originalOrder[index]?.id)) {
      setDraggedCategoryId(null);
      setDragOverCategoryId(null);
      return;
    }

    setIsSavingOrder(true);
    try {
      await categoryService.reorderCategories(reordered.map((cat) => cat.id));
      success('Ordem das linhas de produtos salva com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar ordem das linhas:', err);
      setCategories(originalOrder);
      error('Não foi possível salvar a ordem.');
    } finally {
      setIsSavingOrder(false);
      setDraggedCategoryId(null);
      setDragOverCategoryId(null);
      originalOrderRef.current = null;
    }
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(search.toLowerCase().trim()) ||
    cat.description.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
            Linhas de Produtos
          </h1>
          <p className="text-sm text-trigon-400 mt-1">
            Cadastre novas linhas gerais, como impressões 3D, acessórios, caixas organizadoras e artigos geek
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenCreate}
          icon={<Plus className="w-4 h-4" />}
        >
          Nova Linha de Produtos
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-4 bg-trigon-900/60 p-4 rounded-2xl border border-trigon-800">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-trigon-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-trigon-950 border border-trigon-800 text-white placeholder-trigon-500 text-sm focus:outline-none focus:border-crimson-500 transition-colors"
          />
        </div>
        <div className="text-xs text-trigon-400 font-medium hidden sm:block">
          Total: <strong className="text-white">{filteredCategories.length}</strong> linhas cadastradas
        </div>
      </div>

      {/* Reordering helper hint */}
      {!search.trim() && categories.length > 1 && (
        <p className="text-xs text-trigon-500 flex items-center gap-1.5 px-1">
          <GripVertical className="w-3.5 h-3.5 text-trigon-400" />
          Arraste as linhas para definir a ordem de exibição na vitrine pública.
        </p>
      )}

      {/* Categories List */}
      {loading ? (
        <div className="p-12 text-center text-trigon-400">
          Carregando linhas de produtos...
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-12 text-center bg-trigon-900/40 rounded-2xl border border-trigon-800 space-y-3">
          <Boxes className="w-12 h-12 text-trigon-600 mx-auto" />
          <p className="text-base text-trigon-300">
            {search ? 'Nenhuma linha encontrada para o filtro informado.' : 'Nenhuma linha de produtos cadastrada ainda.'}
          </p>
          {!search && (
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              Cadastrar primeira linha
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((cat) => {
            const count = productCounts[cat.id] || 0;
            const isDragging = draggedCategoryId === cat.id;
            const isDragOver = dragOverCategoryId === cat.id;

            return (
              <div
                key={cat.id}
                draggable={!search.trim() && !isSavingOrder}
                onDragStart={() => handleDragStart(cat.id)}
                onDragOver={(e) => handleDragOver(e, cat.id)}
                onDragEnd={handleDrop}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-trigon-900/80 border transition-all ${
                  isDragging
                    ? 'opacity-40 border-crimson-500 scale-[0.99]'
                    : isDragOver
                    ? 'border-crimson-500 bg-crimson-950/20'
                    : 'border-trigon-800 hover:border-trigon-700'
                }`}
              >
                {/* Drag Handle & Info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`cursor-grab active:cursor-grabbing text-trigon-600 hover:text-trigon-300 transition-colors ${
                      search.trim() ? 'opacity-25 cursor-not-allowed' : ''
                    }`}
                    title={search.trim() ? 'Limpe a busca para reordenar' : 'Arrastar para reordenar'}
                  >
                    <GripVertical className="w-5 h-5" />
                  </div>

                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-trigon-950 border border-trigon-800 overflow-hidden shrink-0">
                    <img
                      src={cat.coverImage}
                      alt={cat.name}
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop';
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Text details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white truncate">
                        {cat.name}
                      </h3>
                      {cat.isActive ? (
                        <Badge variant="success" size="sm" dot>
                          Ativa na Vitrine
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Oculta
                        </Badge>
                      )}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-trigon-950 text-trigon-300 border border-trigon-800">
                        {count} {count === 1 ? 'produto' : 'produtos'}
                      </span>
                    </div>

                    <p className="text-xs text-trigon-400 line-clamp-1 mt-1">
                      {cat.description || 'Sem descrição cadastrada.'}
                    </p>
                    <p className="text-[11px] text-trigon-500 mt-0.5 font-mono">
                      /linhas/{cat.slug}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-trigon-800/60 w-full sm:w-auto justify-end">
                  <a
                    href={`/linhas/${cat.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl text-trigon-400 hover:text-white hover:bg-trigon-800 transition-colors"
                    title="Ver página da linha no catálogo público"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => handleToggleVisibility(cat)}
                    className="p-2 rounded-xl text-trigon-400 hover:text-white hover:bg-trigon-800 transition-colors"
                    title={cat.isActive ? 'Ocultar da vitrine pública' : 'Exibir na vitrine pública'}
                  >
                    {cat.isActive ? (
                      <Eye className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-trigon-500" />
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenEdit(cat)}
                    className="p-2 rounded-xl text-trigon-400 hover:text-white hover:bg-trigon-800 transition-colors"
                    title="Editar linha"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleRequestDelete(cat)}
                    className="p-2 rounded-xl text-trigon-400 hover:text-crimson-400 hover:bg-trigon-800 transition-colors"
                    title="Excluir linha"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Cadastro / Edição de Linha de Produtos */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingCategory ? 'Editar Linha de Produtos' : 'Nova Linha de Produtos'}
        description={
          editingCategory
            ? 'Atualize os dados e a capa desta linha de produtos.'
            : 'Cadastre uma nova linha para organizar produtos gerais (3D, acessórios, caixas, etc).'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div className="space-y-1.5">
            <label className="flex items-center text-xs font-semibold text-trigon-300 h-5">
              Nome da Linha <span className="text-crimson-400 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Impressões 3D, Acessórios TCG, Organização & Sleeves..."
              required
              className="w-full h-10 px-3.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center text-xs font-semibold text-trigon-300 h-5">
              Slug da URL (opcional)
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="Gerado automaticamente a partir do nome se deixado vazio"
              className="w-full h-10 px-3.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 font-mono transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <ImageUploader
              images={formData.coverImage ? [formData.coverImage] : []}
              onChange={(imgs) => setFormData({ ...formData, coverImage: imgs[0] || '' })}
              multiple={false}
              maxImages={1}
              label="Imagem de Capa da Linha"
              folder="categories"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center text-xs font-semibold text-trigon-300 h-5">
              Descrição Curta (opcional)
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva o que os clientes encontrarão nesta linha de produtos..."
              className="w-full px-3.5 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500 resize-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-trigon-950 border border-trigon-800">
            <div>
              <p className="text-xs font-semibold text-white">Linha Ativa na Vitrine</p>
              <p className="text-[11px] text-trigon-400 mt-0.5">
                Se desmarcado, esta linha não aparecerá no carrossel público nem no catálogo geral
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded text-crimson-600 focus:ring-crimson-500 bg-trigon-900 border-trigon-700"
            />
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
              {editingCategory ? 'Salvar Alterações' : 'Cadastrar Linha'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Dialog: Exclusão com Bloqueio de Vínculo */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title={deleteError ? 'Não é possível excluir' : 'Excluir Linha de Produtos'}
        message={
          deleteError
            ? deleteError
            : `Tem certeza de que deseja excluir permanentemente a linha "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`
        }
        confirmText={deleteError ? undefined : 'Sim, Excluir'}
        variant="danger"
      />
    </div>
  );
};
