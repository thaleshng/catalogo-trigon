import React, { useState, useEffect } from 'react';
import { Product, Customer } from '../../types';
import { stockService } from '../../services/stockService';
import { customerService } from '../../services/customerService';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';
import {
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Package,
  Search,
  RotateCcw,
  MapPin,
} from 'lucide-react';

interface RecordSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialProductId?: string;
  onSaleSuccess: () => void;
}

export const RecordSaleModal: React.FC<RecordSaleModalProps> = ({
  isOpen,
  onClose,
  products,
  initialProductId,
  onSaleSuccess,
}) => {
  const availableProducts = products.filter((p) => p.stockQuantity > 0);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [channel, setChannel] = useState<string>('WhatsApp');
  const [paymentMethod, setPaymentMethod] = useState<string>('Pix');
  const [customerName, setCustomerName] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const { success, error } = useToast();

  const currentProduct = products.find((p) => p.id === selectedProductId);

  // Load registered customers on modal open
  useEffect(() => {
    if (isOpen) {
      customerService.getCustomers().then(setCustomers).catch(console.error);
    }
  }, [isOpen]);

  // Initialize selected product
  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    } else if (availableProducts.length > 0 && !selectedProductId) {
      setSelectedProductId(availableProducts[0].id);
    }
  }, [initialProductId, availableProducts]);

  // Sync unitPrice and quantity when product changes
  useEffect(() => {
    if (currentProduct) {
      setUnitPrice(currentProduct.price);
      setQuantity(1);
    }
  }, [selectedProductId]);

  if (!isOpen) return null;

  const catalogPrice = currentProduct?.price || 0;
  const priceDiff = unitPrice - catalogPrice;
  const totalSale = quantity * unitPrice;
  const percentDiff = catalogPrice > 0 ? ((priceDiff / catalogPrice) * 100).toFixed(1) : '0';

  const filteredProducts = availableProducts.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId || !currentProduct) {
      error('Selecione um produto.');
      return;
    }

    if (quantity <= 0) {
      error('A quantidade deve ser maior que zero.');
      return;
    }

    if (quantity > currentProduct.stockQuantity) {
      error(`Estoque insuficiente! Disponível: ${currentProduct.stockQuantity} un.`);
      return;
    }

    if (unitPrice < 0) {
      error('O preço unitário não pode ser negativo.');
      return;
    }

    try {
      setSubmitting(true);
      await stockService.recordSale({
        productId: selectedProductId,
        quantity,
        unitPrice,
        channel,
        customerId: selectedCustomerId && selectedCustomerId !== 'custom' ? selectedCustomerId : undefined,
        customerName: customerName.trim() || undefined,
        paymentMethod,
        notes,
      });

      success(
        `Venda registrada com sucesso! ${quantity} un. de "${currentProduct.name}" por ${formatCurrency(totalSale)}.`
      );
      onSaleSuccess();
      onClose();
    } catch (err: any) {
      error(err.message || 'Erro ao registrar venda.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lançar Venda"
      description="Registre a saída de produtos com rastreabilidade do preço real negociado."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Product Selection & Visual Showcase */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-trigon-300">
              Produto Selecionado *
            </label>
            {availableProducts.length > 1 && (
              <span className="text-[11px] text-trigon-400">
                {availableProducts.length} itens disponíveis em estoque
              </span>
            )}
          </div>

          {/* Search + Selector */}
          <div className="space-y-2">
            {availableProducts.length > 5 && (
              <div className="relative">
                <Search className="w-4 h-4 text-trigon-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar produto por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-1.5 rounded-lg bg-trigon-950 border border-trigon-800 text-xs text-white placeholder-trigon-500 focus:outline-none focus:border-crimson-500"
                />
              </div>
            )}

            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 truncate"
              required
            >
              {filteredProducts.length === 0 ? (
                <option value="" disabled>Nenhum produto encontrado</option>
              ) : (
                filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — Tabela: {formatCurrency(p.price)} ({p.stockQuantity} un. em estoque)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Enhanced Visual Product Preview Card */}
          {currentProduct && (
            <div className="p-3.5 rounded-xl bg-trigon-950 border border-trigon-800/90 flex flex-col sm:flex-row sm:items-center gap-3.5 shadow-inner">
              {/* Product Thumbnail */}
              <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-lg overflow-hidden border border-trigon-750 bg-black/60 shrink-0 flex items-center justify-center">
                {currentProduct.images && currentProduct.images.length > 0 ? (
                  <img
                    src={currentProduct.images[0]}
                    alt={currentProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-8 h-8 text-trigon-600" />
                )}
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <h4 className="font-cinzel text-sm sm:text-base font-bold text-white leading-snug line-clamp-2">
                  {currentProduct.name}
                </h4>

                <div className="flex flex-wrap items-center gap-2">
                  {currentProduct.rarity && (
                    <span className="px-2 py-0.5 rounded-md bg-trigon-800 border border-trigon-700 text-trigon-200 font-medium text-[11px]">
                      {currentProduct.rarity}
                    </span>
                  )}
                  {currentProduct.condition && (
                    <span className="px-2 py-0.5 rounded-md bg-trigon-850 border border-trigon-750 text-trigon-300 text-[11px]">
                      {currentProduct.condition}
                    </span>
                  )}
                  {currentProduct.language && (
                    <span className="px-2 py-0.5 rounded-md bg-trigon-850 border border-trigon-750 text-trigon-300 text-[11px]">
                      {currentProduct.language}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-trigon-400">
                  <span>
                    Preço de Tabela:{' '}
                    <strong className="text-white font-mono">
                      {formatCurrency(currentProduct.price)}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Estoque Atual:{' '}
                    <strong className="text-emerald-400 font-bold">
                      {currentProduct.stockQuantity} un.
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quantities & Price Negotiation Row (Aligned Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Quantity Column */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between h-5 mb-1.5">
              <label className="text-xs font-semibold uppercase text-trigon-300">
                Quantidade a Vender *
              </label>
              <span className="text-[11px] text-trigon-400">
                Max: <strong className="text-white">{currentProduct?.stockQuantity || 1} un.</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-10 h-10 rounded-xl bg-trigon-950 border border-trigon-750 text-trigon-300 hover:text-white hover:border-trigon-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-lg transition-colors"
                title="Diminuir quantidade"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max={currentProduct?.stockQuantity || 1}
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    Math.min(
                      currentProduct?.stockQuantity || 1,
                      Math.max(1, parseInt(e.target.value) || 1)
                    )
                  )
                }
                className="flex-1 h-10 px-3 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-center font-bold text-base focus:outline-none focus:border-crimson-500"
                required
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(currentProduct?.stockQuantity || 1, q + 1))}
                disabled={!currentProduct || quantity >= currentProduct.stockQuantity}
                className="w-10 h-10 rounded-xl bg-trigon-950 border border-trigon-750 text-trigon-300 hover:text-white hover:border-trigon-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-lg transition-colors"
                title="Aumentar quantidade"
              >
                +
              </button>
            </div>

            <p className="text-[11px] text-trigon-500 mt-1.5">
              Restarão{' '}
              <strong className="text-trigon-300">
                {Math.max(0, (currentProduct?.stockQuantity || 0) - quantity)} un.
              </strong>{' '}
              em estoque após esta venda
            </p>
          </div>

          {/* Negotiated Unit Price Column */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between h-5 mb-1.5">
              <label className="text-xs font-semibold uppercase text-trigon-300">
                Preço Unitário Praticado *
              </label>
              {unitPrice !== catalogPrice && (
                <button
                  type="button"
                  onClick={() => setUnitPrice(catalogPrice)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-crimson-400 hover:text-crimson-300 transition-colors"
                  title="Restaurar preço oficial de tabela"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar</span>
                </button>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-trigon-400">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white font-bold text-base focus:outline-none focus:border-crimson-500 font-mono"
                required
              />
            </div>

            <p className="text-[11px] text-trigon-400 mt-1.5">
              Preço de Tabela original:{' '}
              <span className="text-trigon-200 font-mono font-medium">
                {formatCurrency(catalogPrice)}
              </span>
            </p>
          </div>
        </div>

        {/* Price Variation & Total Summary Card */}
        <div className="p-4 rounded-xl bg-trigon-950/90 border border-trigon-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-trigon-400">Negociação em relação à tabela:</span>
            {priceDiff === 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" />
                Preço Padrão de Tabela
              </span>
            ) : priceDiff < 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-400 font-semibold">
                <TrendingDown className="w-3.5 h-3.5" />
                Desconto de {formatCurrency(Math.abs(priceDiff))} ({percentDiff}%) por un.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-950/60 border border-sky-500/30 text-sky-400 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                Ágio de +{formatCurrency(priceDiff)} (+{percentDiff}%) por un.
              </span>
            )}
          </div>

          <div className="pt-2.5 border-t border-trigon-800 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-trigon-300 tracking-wider">
                Valor Total da Venda ({quantity} {quantity === 1 ? 'item' : 'itens'}):
              </span>
              {priceDiff !== 0 && (
                <p className="text-[11px] text-trigon-500 mt-0.5">
                  Tabela original: {formatCurrency(catalogPrice * quantity)}
                </p>
              )}
            </div>
            <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
              {formatCurrency(totalSale)}
            </span>
          </div>
        </div>

        {/* Channel and Payment Method Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="h-5 mb-1.5 text-xs font-semibold uppercase text-trigon-300 flex items-center">
              Canal da Venda *
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            >
              <option value="WhatsApp">WhatsApp</option>
              <option value="Instagram">Instagram</option>
              <option value="Jamble">Jamble</option>
              <option value="Outro Canal">Outro Canal</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="h-5 mb-1.5 text-xs font-semibold uppercase text-trigon-300 flex items-center">
              Forma de Pagamento *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            >
              <option value="Pix">Pix</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Dinheiro">Dinheiro em Espécie</option>
              <option value="Transferência">Transferência Bancária</option>
            </select>
          </div>
        </div>

        {/* Customer and Notes Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <div className="h-5 mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-trigon-300">
                Cliente
              </label>
              {customers.length > 0 && (
                <span className="text-[10px] text-trigon-400">
                  {customers.length} cadastrado(s)
                </span>
              )}
            </div>
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                const cId = e.target.value;
                setSelectedCustomerId(cId);
                if (cId && cId !== 'custom') {
                  const found = customers.find((c) => c.id === cId);
                  if (found) setCustomerName(found.name);
                } else if (cId !== 'custom') {
                  setCustomerName('');
                }
              }}
              className="w-full h-10 px-3.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 truncate"
            >
              <option value="">Selecione o Cliente (opcional)...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `— ${c.phone}` : ''}
                </option>
              ))}
              <option value="custom">+ Outro / Digitar avulso...</option>
            </select>

            {selectedCustomerId === 'custom' && (
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente avulso..."
                className="w-full h-10 px-3.5 mt-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 placeholder-trigon-600 animate-in fade-in"
                autoFocus
              />
            )}

            {(() => {
              const cust = customers.find((c) => c.id === selectedCustomerId);
              if (cust && (cust.street || cust.cep)) {
                return (
                  <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0 text-emerald-400" />
                    <span>
                      Envio: {cust.street}, {cust.number || 'S/N'} • {cust.city}/{cust.state}
                    </span>
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div className="flex flex-col">
            <label className="h-5 mb-1.5 text-xs font-semibold uppercase text-trigon-300 flex items-center">
              Observações (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Desconto no lote, brinde incluso..."
              className="w-full h-10 px-3.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 placeholder-trigon-600"
            />
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-trigon-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            icon={<ShoppingCart className="w-4 h-4" />}
          >
            Confirmar Venda ({formatCurrency(totalSale)})
          </Button>
        </div>
      </form>
    </Modal>
  );
};
