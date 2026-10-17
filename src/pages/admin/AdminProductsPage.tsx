import React, { useEffect, useState } from 'react';
import { Product, Collection, Category } from '../../types';
import { productService } from '../../services/productService';
import { collectionService } from '../../services/collectionService';
import { categoryService } from '../../services/categoryService';
import { useToast } from '../../components/common/Toast';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ImageUploader } from '../../components/common/ImageUploader';
import { RecordSaleModal } from '../../components/admin/RecordSaleModal';
import {
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Search,
  ShoppingCart,
  Layers,
  Boxes,
} from 'lucide-react';

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilterOrg, setSelectedFilterOrg] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK' | 'HIDDEN'>('ALL');

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [organizationType, setOrganizationType] = useState<'collection' | 'category'>('collection');

  // Sale Modal state
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleProductId, setSaleProductId] = useState<string | undefined>(undefined);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    collectionId: '',
    categoryId: '',
    description: '',
    price: 0,
    stockQuantity: 1,
    images: [] as string[],
    isActive: true,
    rarity: '',
    language: 'Português',
    condition: 'Mint / Fresh Pack',
  });

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { success, error } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cols, cats] = await Promise.all([
        productService.getProducts(),
        collectionService.getCollections(false),
        categoryService.getCategories(false),
      ]);
      setProducts(prods);
      setCollections(cols);
      setCategories(cats);
    } catch (err) {
      console.error(err);
      error('Falha ao carregar lista de produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setOrganizationType('collection');
    setFormData({
      name: '',
      slug: '',
      collectionId: collections[0]?.id || '',
      categoryId: categories[0]?.id || '',
      description: '',
      price: 99.90,
      stockQuantity: 1,
      images: ['https://images.unsplash.com/photo-1613770742268-3693246eb77a?q=80&w=1000&auto=format&fit=crop'],
      isActive: true,
      rarity: 'Rara',
      language: 'Português',
      condition: 'Mint / Fresh Pack',
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    const isCat = Boolean(prod.categoryId && !prod.collectionId);
    setOrganizationType(isCat ? 'category' : 'collection');
    setFormData({
      name: prod.name,
      slug: prod.slug,
      collectionId: prod.collectionId || collections[0]?.id || '',
      categoryId: prod.categoryId || categories[0]?.id || '',
      description: prod.description,
      price: prod.price,
      stockQuantity: prod.stockQuantity,
      images: prod.images && prod.images.length > 0 ? [...prod.images] : [],
      isActive: prod.isActive,
      rarity: prod.rarity || '',
      language: prod.language || 'Português',
      condition: prod.condition || 'Mint / Fresh Pack',
    });
    setIsFormOpen(true);
  };

  const handleOpenSaleModal = (productId?: string) => {
    setSaleProductId(productId);
    setIsSaleModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      error('O nome do produto é obrigatório.');
      return;
    }
    if (organizationType === 'collection' && !formData.collectionId) {
      error('Selecione uma Coleção TCG para vincular o produto.');
      return;
    }
    if (organizationType === 'category' && !formData.categoryId) {
      error('Selecione uma Linha de Produtos para vincular o produto.');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        slug: formData.slug || undefined,
        collectionId: organizationType === 'collection' ? formData.collectionId : null,
        categoryId: organizationType === 'category' ? formData.categoryId : null,
        description: formData.description,
        price: Number(formData.price),
        stockQuantity: Number(formData.stockQuantity),
        images: formData.images.length > 0 ? formData.images : ['https://images.unsplash.com/photo-1613770742268-3693246eb77a?q=80&w=1000&auto=format&fit=crop'],
        isActive: formData.isActive,
        rarity: formData.rarity,
        language: formData.language,
        condition: formData.condition,
      };

      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, payload);
        success(`Produto "${formData.name}" atualizado com sucesso!`);
      } else {
        await productService.createProduct({
          ...payload,
          slug: formData.slug || '',
        });
        success(`Produto "${formData.name}" adicionado com sucesso!`);
      }

      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      error(err.message || 'Erro ao salvar produto');
    }
  };

  const handleToggleVisibility = async (prod: Product) => {
    try {
      const updated = await productService.updateProduct(prod.id, {
        isActive: !prod.isActive,
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? updated : p))
      );
      success(
        `Produto "${prod.name}" ${updated.isActive ? 'ativado' : 'ocultado'}.`
      );
    } catch (err) {
      error('Erro ao atualizar visibilidade');
    }
  };

  const handleRequestDelete = (prod: Product) => {
    setDeleteTarget(prod);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await productService.deleteProduct(deleteTarget.id);
      success(`Produto "${deleteTarget.name}" excluído!`);
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      error('Erro ao excluir produto');
    }
  };

  // Filtragem
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      (p.rarity && p.rarity.toLowerCase().includes(searchTerm.toLowerCase().trim()));
    if (!matchesSearch) return false;

    if (selectedFilterOrg !== 'ALL') {
      if (selectedFilterOrg.startsWith('col:')) {
        const colId = selectedFilterOrg.replace('col:', '');
        if (p.collectionId !== colId) return false;
      } else if (selectedFilterOrg.startsWith('cat:')) {
        const catId = selectedFilterOrg.replace('cat:', '');
        if (p.categoryId !== catId) return false;
      }
    }

    if (stockFilter === 'IN_STOCK' && p.stockQuantity <= 0) return false;
    if (stockFilter === 'OUT_OF_STOCK' && p.stockQuantity > 0) return false;
    if (stockFilter === 'HIDDEN' && p.isActive) return false;

    return true;
  });

  const getCollectionName = (id?: string | null) => {
    if (!id) return '';
    const col = collections.find((c) => c.id === id);
    return col ? col.name : 'Coleção desconhecida';
  };

  const getCategoryName = (id?: string | null) => {
    if (!id) return '';
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.name : 'Linha desconhecida';
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
            Gerenciamento de Produtos
          </h1>
          <p className="text-sm text-trigon-400 mt-1">
            Cadastre singles, caixas seladas e edições com fotos por upload e lance vendas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleOpenSaleModal()}
            icon={<ShoppingCart className="w-4 h-4 text-emerald-400" />}
          >
            Lançar Venda
          </Button>

          <Button
            variant="primary"
            onClick={handleOpenCreate}
            icon={<Plus className="w-4 h-4" />}
          >
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-trigon-900/70 p-4 rounded-2xl border border-trigon-800 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, raridade..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white placeholder-trigon-500 text-sm focus:outline-none focus:border-crimson-500"
          />
        </div>

        {/* Filters */}
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Organization filter select */}
          <select
            value={selectedFilterOrg}
            onChange={(e) => setSelectedFilterOrg(e.target.value)}
            className="bg-trigon-950 border border-trigon-750 text-trigon-200 text-xs sm:text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-crimson-500"
          >
            <option value="ALL">Todas as Organizações</option>
            {collections.length > 0 && (
              <optgroup label="Coleções TCG">
                {collections.map((c) => (
                  <option key={c.id} value={`col:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            {categories.length > 0 && (
              <optgroup label="Linhas de Produtos">
                {categories.map((cat) => (
                  <option key={cat.id} value={`cat:${cat.id}`}>
                    {cat.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Stock filter select */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="bg-trigon-950 border border-trigon-750 text-trigon-200 text-xs sm:text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-crimson-500"
          >
            <option value="ALL">Todos os Status</option>
            <option value="IN_STOCK">Em Estoque</option>
            <option value="OUT_OF_STOCK">Esgotados</option>
            <option value="HIDDEN">Ocultos</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl bg-trigon-900 border border-trigon-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-trigon-300">
            <thead className="bg-trigon-950/80 border-b border-trigon-800 text-xs uppercase text-trigon-400 font-semibold tracking-wider">
              <tr>
                <th className="px-5 py-4">Produto</th>
                <th className="px-5 py-4">Organização</th>
                <th className="px-5 py-4">Preço</th>
                <th className="px-5 py-4">Estoque</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-trigon-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-trigon-500">
                    Carregando produtos...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-trigon-500">
                    Nenhum produto cadastrado ou correspondente aos filtros.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const mainImage = prod.images[0] || 'https://images.unsplash.com/photo-1613770742268-3693246eb77a?q=80&w=300&auto=format&fit=crop';
                  return (
                    <tr
                      key={prod.id}
                      className="hover:bg-trigon-850/50 transition-colors"
                    >
                      {/* Product image & title */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-trigon-950 border border-trigon-800 overflow-hidden shrink-0 p-1 flex items-center justify-center">
                            <img
                              src={mainImage}
                              onError={(e) => {
                                e.currentTarget.src = '/images/trigon-hero-bg.jpg';
                              }}
                              alt={prod.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <p className="font-semibold text-white truncate">
                              {prod.name}
                            </p>
                            <p className="text-xs text-trigon-400 truncate">
                              {prod.rarity || 'Sem raridade especificada'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Organization (Collection or Category) */}
                      <td className="px-5 py-3">
                        {prod.collectionId ? (
                          <div className="inline-flex items-center gap-1.5 text-xs text-trigon-200 bg-trigon-950 px-2.5 py-1 rounded-lg border border-trigon-800">
                            <Layers className="w-3.5 h-3.5 text-crimson-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{getCollectionName(prod.collectionId)}</span>
                          </div>
                        ) : prod.categoryId ? (
                          <div className="inline-flex items-center gap-1.5 text-xs text-amber-300 bg-trigon-950 px-2.5 py-1 rounded-lg border border-amber-900/40">
                            <Boxes className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{getCategoryName(prod.categoryId)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-trigon-500 italic">Sem vínculo</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="px-5 py-3 font-semibold text-white whitespace-nowrap">
                        {formatCurrency(prod.price)}
                      </td>

                      {/* Stock */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        {prod.stockQuantity === 0 ? (
                          <Badge variant="danger" size="sm" dot>
                            Esgotado
                          </Badge>
                        ) : prod.stockQuantity <= 2 ? (
                          <Badge variant="warning" size="sm" dot>
                            {prod.stockQuantity} un.
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm" dot>
                            {prod.stockQuantity} un.
                          </Badge>
                        )}
                      </td>

                      {/* Visibility */}
                      <td className="px-5 py-3">
                        {prod.isActive ? (
                          <Badge variant="success" size="sm">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            Oculto
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {prod.stockQuantity > 0 && (
                            <button
                              onClick={() => handleOpenSaleModal(prod.id)}
                              className="p-1.5 rounded-lg border border-emerald-600/40 text-emerald-300 hover:bg-emerald-950/40 transition-colors"
                              title="Lançar Venda"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleVisibility(prod)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              prod.isActive
                                ? 'border-trigon-750 text-trigon-300 hover:text-white hover:bg-trigon-800'
                                : 'border-emerald-600/40 text-emerald-400 hover:bg-emerald-950/40'
                            }`}
                            title={prod.isActive ? 'Ocultar Produto' : 'Ativar Produto'}
                          >
                            {prod.isActive ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>

                          <a
                            href={`/produtos/${prod.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-trigon-750 text-trigon-300 hover:text-white hover:bg-trigon-800 transition-colors"
                            title="Ver página pública do produto"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenEdit(prod)}
                            icon={<Edit2 className="w-3.5 h-3.5" />}
                          >
                            Editar
                          </Button>

                          <button
                            onClick={() => handleRequestDelete(prod)}
                            className="p-1.5 rounded-lg text-crimson-400 hover:text-crimson-300 hover:bg-crimson-950/40 border border-crimson-900/50 transition-colors"
                            title="Excluir Produto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
        description="Preencha os dados e gerencie as fotos por upload direto do seu dispositivo"
        maxWidth="xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Nome do Produto *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Charizard ex SAR, Elite Trainer Box..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                required
              />
            </div>

            {/* Organization Type Selector */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Tipo de Organização *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrganizationType('collection')}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    organizationType === 'collection'
                      ? 'bg-crimson-950/80 border-crimson-600/70 text-white shadow-sm'
                      : 'bg-trigon-950 border-trigon-800 text-trigon-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4 text-crimson-400" />
                  <span>Coleção TCG</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrganizationType('category')}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    organizationType === 'category'
                      ? 'bg-crimson-950/80 border-crimson-600/70 text-white shadow-sm'
                      : 'bg-trigon-950 border-trigon-800 text-trigon-400 hover:text-white'
                  }`}
                >
                  <Boxes className="w-4 h-4 text-crimson-400" />
                  <span>Linha de Produtos</span>
                </button>
              </div>
            </div>

            {/* Dynamic Selector: Collection vs Category */}
            {organizationType === 'collection' ? (
              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  Coleção TCG Vinculada *
                </label>
                <select
                  value={formData.collectionId}
                  onChange={(e) =>
                    setFormData({ ...formData, collectionId: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                  required
                >
                  <option value="" disabled>Selecione uma coleção TCG</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  Linha de Produtos Vinculada *
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) =>
                    setFormData({ ...formData, categoryId: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                  required
                >
                  <option value="" disabled>Selecione uma linha de produtos</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Slug */}
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Slug da URL (opcional)
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="Gerado automaticamente se em branco"
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-mono text-xs"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Preço em R$ *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                required
              />
            </div>

            {/* Stock Quantity */}
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Quantidade em Estoque *
              </label>
              <input
                type="number"
                min="0"
                value={formData.stockQuantity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stockQuantity: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                required
              />
            </div>

            {/* Rarity */}
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Raridade / Categoria
              </label>
              <input
                type="text"
                value={formData.rarity}
                onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                placeholder="Ex: Special Art Rare (SAR), Promo, ETB..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              />
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Idioma
              </label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              >
                <option value="Português">Português</option>
                <option value="Inglês">Inglês</option>
                <option value="Japonês">Japonês</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold uppercase text-trigon-300">
                Descrição Completa
              </label>
              <span className="text-[11px] text-trigon-400">
                Dica: use <span className="text-amber-400 font-mono font-medium">*texto*</span> para <strong>negrito</strong> e <span className="text-amber-400 font-mono font-medium">_texto_</span> para <em>itálico</em>
              </span>
            </div>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descreva detalhes da carta, estado de conservação ou conteúdo da caixa..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 resize-none"
            />
          </div>

          {/* Image Uploader (File upload + Drag&Drop + Preview) */}
          <ImageUploader
            images={formData.images}
            onChange={(imgs) => setFormData({ ...formData, images: imgs })}
            multiple={true}
            maxImages={8}
            label="Fotos do Produto (Upload com Preview Instantâneo)"
          />

          {/* Visibility Checkbox */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="productActiveCheck"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
              className="w-4 h-4 rounded text-crimson-600 bg-trigon-950 border-trigon-750 focus:ring-crimson-500"
            />
            <label
              htmlFor="productActiveCheck"
              className="text-sm font-medium text-trigon-200 cursor-pointer"
            >
              Ativar e exibir produto no catálogo público
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
              {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Produto?"
        message={`Deseja realmente remover o produto "${deleteTarget?.name}"? Esta ação removerá o item permanentemente do catálogo.`}
        confirmText="Sim, excluir produto"
        variant="danger"
      />

      {/* Record Sale Modal */}
      <RecordSaleModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        products={products}
        initialProductId={saleProductId}
        onSaleSuccess={loadData}
      />
    </div>
  );
};
