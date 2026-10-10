import React, { useEffect, useState } from 'react';
import { Product, StockMovement, StockMovementType } from '../../types';
import { productService } from '../../services/productService';
import { stockService } from '../../services/stockService';
import { useToast } from '../../components/common/Toast';
import { formatDateTime, formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { RecordSaleModal } from '../../components/admin/RecordSaleModal';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Search,
  ShoppingCart,
} from 'lucide-react';

export const AdminStockPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Movement Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [movementType, setMovementType] = useState<StockMovementType>('ENTRADA');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Sale Modal
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleProductId, setSaleProductId] = useState<string | undefined>(undefined);

  const { success, error } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, movs] = await Promise.all([
        productService.getProducts(),
        stockService.getMovements(),
      ]);
      setProducts(prods);
      setMovements(movs);
      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].id);
      }
    } catch (err) {
      console.error(err);
      error('Erro ao carregar dados de estoque');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleOpenMovementModal = (
    product?: Product,
    defaultType: StockMovementType = 'ENTRADA'
  ) => {
    if (product) {
      setSelectedProductId(product.id);
    }
    setMovementType(defaultType);
    setQuantity(1);
    setReason(defaultType === 'ENTRADA' ? 'Recebimento de lote' : 'Ajuste manual');
    setIsModalOpen(true);
  };

  const handleOpenSaleModal = (productId?: string) => {
    setSaleProductId(productId);
    setIsSaleModalOpen(true);
  };

  const handleApplyQuickAdjustment = async (
    product: Product,
    type: StockMovementType,
    amount: number
  ) => {
    if (type === 'SAIDA' && product.stockQuantity < amount) {
      error(
        `Estoque insuficiente! O item possui apenas ${product.stockQuantity} unidade(s).`
      );
      return;
    }

    try {
      const defaultReason =
        type === 'ENTRADA' ? 'Entrada rápida (+)' : 'Ajuste de saída rápido (-)';
      const { updatedProduct } = await stockService.recordMovement(
        product.id,
        type,
        amount,
        defaultReason
      );

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? updatedProduct : p))
      );
      const updatedMovs = await stockService.getMovements();
      setMovements(updatedMovs);

      success(
        `Estoque de "${product.name}" atualizado para ${updatedProduct.stockQuantity} un.`
      );
    } catch (err: any) {
      error(err.message || 'Erro ao registrar movimentação rápida');
    }
  };

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      error('Selecione um produto.');
      return;
    }

    if (quantity <= 0) {
      error('A quantidade deve ser maior que zero.');
      return;
    }

    if (
      movementType === 'SAIDA' &&
      selectedProduct &&
      selectedProduct.stockQuantity < quantity
    ) {
      error(
        `Estoque insuficiente. Estoque atual: ${selectedProduct.stockQuantity} un.`
      );
      return;
    }

    try {
      setSubmitting(true);
      const { updatedProduct } = await stockService.recordMovement(
        selectedProductId,
        movementType,
        quantity,
        reason
      );

      setProducts((prev) =>
        prev.map((p) => (p.id === selectedProductId ? updatedProduct : p))
      );
      const updatedMovs = await stockService.getMovements();
      setMovements(updatedMovs);

      success(
        `Movimentação registrada com sucesso! Novo estoque: ${updatedProduct.stockQuantity} un.`
      );
      setIsModalOpen(false);
    } catch (err: any) {
      error(err.message || 'Erro ao registrar movimentação');
    } finally {
      setSubmitting(false);
    }
  };

  const previewStock = selectedProduct
    ? movementType === 'ENTRADA'
      ? selectedProduct.stockQuantity + quantity
      : Math.max(0, selectedProduct.stockQuantity - quantity)
    : 0;

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="space-y-8">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
            Controle de Estoque & Vendas
          </h1>
          <p className="text-sm text-trigon-400 mt-1">
            Lance vendas com rastreabilidade de preço, registre entradas/saídas e acompanhe o histórico
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => handleOpenSaleModal()}
            icon={<ShoppingCart className="w-4 h-4" />}
          >
            Lançar Venda
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleOpenMovementModal()}
            icon={<ArrowLeftRight className="w-4 h-4" />}
          >
            Movimentação Manual
          </Button>
        </div>
      </div>

      {/* Stock Management by Product Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-trigon-900/60 p-4 rounded-2xl border border-trigon-800">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar item no estoque..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white placeholder-trigon-500 text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>
          <span className="text-xs text-trigon-400">
            Total de Itens: <strong className="text-white">{products.length}</strong>
          </span>
        </div>

        <div className="rounded-2xl bg-trigon-900 border border-trigon-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-trigon-300">
              <thead className="bg-trigon-950/80 border-b border-trigon-800 text-xs uppercase text-trigon-400 font-semibold tracking-wider">
                <tr>
                  <th className="px-5 py-4">Produto</th>
                  <th className="px-5 py-4">Estoque Atual</th>
                  <th className="px-5 py-4">Preço Tabela</th>
                  <th className="px-5 py-4">Ajustes Rápidos (+/-)</th>
                  <th className="px-5 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trigon-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-trigon-500">
                      Carregando inventário de estoque...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-trigon-500">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => (
                    <tr key={prod.id} className="hover:bg-trigon-850/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-trigon-950 border border-trigon-800 overflow-hidden shrink-0 p-1">
                            <img
                              src={prod.images[0] || ''}
                              onError={(e) => {
                                e.currentTarget.src = '/images/trigon-hero-bg.jpg';
                              }}
                              alt={prod.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="font-semibold text-white truncate max-w-xs sm:max-w-md">
                            {prod.name}
                          </span>
                        </div>
                      </td>

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

                      <td className="px-5 py-3 font-semibold text-white whitespace-nowrap">
                        {formatCurrency(prod.price)}
                      </td>

                      {/* Quick increment/decrement buttons */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleApplyQuickAdjustment(prod, 'SAIDA', 1)}
                            disabled={prod.stockQuantity < 1}
                            className="px-2 py-1 rounded bg-trigon-950 hover:bg-red-950/60 border border-trigon-800 hover:border-red-600/50 text-red-400 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Remover 1 unidade"
                          >
                            -1
                          </button>
                          <button
                            onClick={() => handleApplyQuickAdjustment(prod, 'SAIDA', 5)}
                            disabled={prod.stockQuantity < 5}
                            className="px-2 py-1 rounded bg-trigon-950 hover:bg-red-950/60 border border-trigon-800 hover:border-red-600/50 text-red-400 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Remover 5 unidades"
                          >
                            -5
                          </button>
                          <span className="text-trigon-700 px-1">|</span>
                          <button
                            onClick={() => handleApplyQuickAdjustment(prod, 'ENTRADA', 1)}
                            className="px-2 py-1 rounded bg-trigon-950 hover:bg-emerald-950/60 border border-trigon-800 hover:border-emerald-600/50 text-emerald-400 text-xs font-bold transition-colors"
                            title="Adicionar 1 unidade"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleApplyQuickAdjustment(prod, 'ENTRADA', 5)}
                            className="px-2 py-1 rounded bg-trigon-950 hover:bg-emerald-950/60 border border-trigon-800 hover:border-emerald-600/50 text-emerald-400 text-xs font-bold transition-colors"
                            title="Adicionar 5 unidades"
                          >
                            +5
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {prod.stockQuantity > 0 && (
                            <button
                              onClick={() => handleOpenSaleModal(prod.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 transition-all shadow-sm"
                              title="Lançar Venda deste produto"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>Vender</span>
                            </button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenMovementModal(prod)}
                            icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
                          >
                            Ajustar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Movement History Table */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-cinzel text-xl font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-crimson-400" />
            <span>Histórico de Movimentações & Vendas</span>
          </h2>
          <span className="text-xs text-trigon-400">
            {movements.length} registro(s)
          </span>
        </div>

        <div className="rounded-2xl bg-trigon-900 border border-trigon-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-trigon-300">
              <thead className="bg-trigon-950/80 border-b border-trigon-800 text-xs uppercase text-trigon-400 font-semibold tracking-wider">
                <tr>
                  <th className="px-5 py-4">Data e Hora</th>
                  <th className="px-5 py-4">Produto</th>
                  <th className="px-5 py-4">Tipo</th>
                  <th className="px-5 py-4">Quantidade</th>
                  <th className="px-5 py-4">Detalhes / Rastreabilidade</th>
                  <th className="px-5 py-4 text-right">Estoque (De ➔ Para)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trigon-800/80">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-trigon-500">
                      Nenhuma movimentação registrada no sistema.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov) => {
                    const isSale = mov.totalValue !== undefined;
                    return (
                      <tr key={mov.id} className="hover:bg-trigon-850/50 transition-colors">
                        <td className="px-5 py-3.5 text-xs text-trigon-400 whitespace-nowrap">
                          {formatDateTime(mov.date)}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-white truncate max-w-xs">
                          {mov.productName}
                        </td>
                        <td className="px-5 py-3.5">
                          {isSale ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                              <ShoppingCart className="w-3.5 h-3.5" />
                              Venda
                            </span>
                          ) : mov.type === 'ENTRADA' ? (
                            <Badge variant="success" size="sm">
                              <span className="flex items-center gap-1">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                Entrada
                              </span>
                            </Badge>
                          ) : (
                            <Badge variant="danger" size="sm">
                              <span className="flex items-center gap-1">
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                                Saída
                              </span>
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-bold whitespace-nowrap">
                          <span
                            className={
                              mov.type === 'ENTRADA'
                                ? 'text-emerald-400'
                                : isSale
                                ? 'text-emerald-300'
                                : 'text-red-400'
                            }
                          >
                            {mov.type === 'ENTRADA' ? `+${mov.quantity}` : `-${mov.quantity}`} un.
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-trigon-300">
                          <div className="space-y-0.5">
                            <p className="font-medium text-white">{mov.reason}</p>
                            {isSale && mov.unitPrice !== undefined && (
                              <div className="flex items-center gap-2 text-[11px] text-trigon-400 font-mono">
                                <span>Unit: <strong className="text-emerald-400">{formatCurrency(mov.unitPrice)}</strong></span>
                                {mov.originalPrice && mov.unitPrice !== mov.originalPrice && (
                                  <span className="text-trigon-500 line-through">
                                    (Tabela: {formatCurrency(mov.originalPrice)})
                                  </span>
                                )}
                                <span>• Total: <strong className="text-white">{formatCurrency(mov.totalValue || 0)}</strong></span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs whitespace-nowrap">
                          <span className="text-trigon-500">{mov.previousStock}</span>
                          <span className="text-trigon-600 mx-1.5">➔</span>
                          <span className="text-white font-semibold">{mov.newStock} un.</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Movement Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Movimentação Manual de Estoque"
        description="Ajuste o inventário informando a quantidade e justificativa."
        maxWidth="md"
      >
        <form onSubmit={handleSubmitMovement} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Produto *
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              required
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Atual: {p.stockQuantity} un.)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
              Tipo de Movimentação *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMovementType('ENTRADA')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                  movementType === 'ENTRADA'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-md'
                    : 'bg-trigon-950 border-trigon-750 text-trigon-400 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                <span>Entrada (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('SAIDA')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                  movementType === 'SAIDA'
                    ? 'bg-red-950/80 border-red-500 text-red-300 shadow-md'
                    : 'bg-trigon-950 border-trigon-750 text-trigon-400 hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-red-400" />
                <span>Saída (-)</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Quantidade *
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Motivo do Ajuste *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Recebimento de compra, conferência física..."
              className="w-full px-3.5 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
              required
            />
          </div>

          {selectedProduct && (
            <div className="p-3.5 rounded-xl bg-trigon-950 border border-trigon-800 text-xs flex items-center justify-between">
              <div>
                <span className="text-trigon-400 block">Estoque Atual:</span>
                <span className="font-bold text-white">{selectedProduct.stockQuantity} un.</span>
              </div>
              <div className="text-trigon-500 font-bold">➔</div>
              <div className="text-right">
                <span className="text-trigon-400 block">Novo Estoque:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {previewStock} un.
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-trigon-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
            >
              Confirmar Ajuste
            </Button>
          </div>
        </form>
      </Modal>

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
