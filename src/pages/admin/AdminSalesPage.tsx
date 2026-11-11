import React, { useEffect, useState, useMemo } from 'react';
import { StockMovement, Product, Customer } from '../../types';
import { stockService } from '../../services/stockService';
import { productService } from '../../services/productService';
import { customerService } from '../../services/customerService';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { RecordSaleModal } from '../../components/admin/RecordSaleModal';
import { CustomerVaultModal } from '../../components/admin/CustomerVaultModal';
import { useToast } from '../../components/common/Toast';
import {
  ShoppingCart,
  Package,
  Search,
  RefreshCw,
  Copy,
  Check,
  Archive,
  ExternalLink,
} from 'lucide-react';

export const AdminSalesPage: React.FC = () => {
  const [sales, setSales] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('ALL');
  const [selectedPayment, setSelectedPayment] = useState('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Modais
  const [isRecordSaleOpen, setIsRecordSaleOpen] = useState(false);
  const [selectedCustomerForVault, setSelectedCustomerForVault] = useState<Customer | null>(null);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { success, error } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [allMovements, allProducts, allCustomers] = await Promise.all([
        stockService.getMovements(),
        productService.getProducts(),
        customerService.getCustomers(),
      ]);

      // Vendas são saídas que possuem unitPrice ou motivo de venda
      const salesMovements = allMovements.filter(
        (m) =>
          m.type === 'SAIDA' &&
          (m.unitPrice !== undefined ||
            m.totalValue !== undefined ||
            m.reason.toLowerCase().includes('venda'))
      );

      setSales(salesMovements);
      setProducts(allProducts);
      setCustomers(allCustomers);
    } catch (err: any) {
      console.error(err);
      error('Erro ao carregar histórico de vendas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  const customerMap = useMemo(() => {
    return new Map(customers.map((c) => [c.id, c]));
  }, [customers]);

  // Filtragem
  const filteredSales = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const now = new Date();

    return sales.filter((sale) => {
      // Busca textual
      if (term) {
        const prod = productMap.get(sale.productId);
        const matchName = sale.productName.toLowerCase().includes(term);
        const matchProd = prod?.name.toLowerCase().includes(term);
        const matchCustomer = (sale.customerName || '').toLowerCase().includes(term);
        const matchReason = (sale.reason || '').toLowerCase().includes(term);
        const matchPayment = (sale.paymentMethod || '').toLowerCase().includes(term);
        const matchChannel = (sale.channel || '').toLowerCase().includes(term);

        if (!matchName && !matchProd && !matchCustomer && !matchReason && !matchPayment && !matchChannel) {
          return false;
        }
      }

      // Filtro de canal
      if (selectedChannel !== 'ALL') {
        const saleChan = sale.channel || 'WhatsApp';
        if (saleChan.toLowerCase() !== selectedChannel.toLowerCase()) {
          return false;
        }
      }

      // Filtro de pagamento
      if (selectedPayment !== 'ALL') {
        const salePay = sale.paymentMethod || 'Pix';
        if (salePay.toLowerCase() !== selectedPayment.toLowerCase()) {
          return false;
        }
      }

      // Filtro de cliente
      if (selectedCustomerId !== 'ALL') {
        if (sale.customerId !== selectedCustomerId) {
          return false;
        }
      }

      // Filtro de período
      if (selectedPeriod !== 'ALL') {
        const saleDate = new Date(sale.date);
        if (selectedPeriod === 'TODAY') {
          if (saleDate.toDateString() !== now.toDateString()) return false;
        } else if (selectedPeriod === 'WEEK') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (saleDate < sevenDaysAgo) return false;
        } else if (selectedPeriod === 'MONTH') {
          if (
            saleDate.getMonth() !== now.getMonth() ||
            saleDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        }
      }

      return true;
    });
  }, [sales, searchTerm, selectedChannel, selectedPayment, selectedCustomerId, selectedPeriod, productMap]);

  // Indicadores dos itens filtrados
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalUnits = 0;
    let totalDiscount = 0;
    let totalVaultSales = 0;

    filteredSales.forEach((s) => {
      const lineTotal = s.totalValue || (s.unitPrice ? s.unitPrice * s.quantity : 0);
      totalRevenue += lineTotal;
      totalUnits += s.quantity || 0;

      if (s.originalPrice && s.unitPrice && s.unitPrice < s.originalPrice) {
        totalDiscount += (s.originalPrice - s.unitPrice) * s.quantity;
      }

      if (s.customerId) {
        totalVaultSales += 1;
      }
    });

    const averageTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

    return {
      totalRevenue,
      totalUnits,
      salesCount: filteredSales.length,
      averageTicket,
      totalDiscount,
      totalVaultSales,
    };
  }, [filteredSales]);

  // Copiar Comprovante da Venda para WhatsApp
  const handleCopySaleReceipt = async (sale: StockMovement) => {
    const prod = productMap.get(sale.productId);
    const prodName = prod?.name || sale.productName;
    const unitPrice = sale.unitPrice || prod?.price || 0;
    const total = sale.totalValue || unitPrice * sale.quantity;

    let text = [
      `🧾 *COMPROVANTE DE VENDA — TRIGON TCG* 🔺`,
      `📦 *Produto:* ${sale.quantity}x ${prodName}`,
      `💰 *Preço Unitário:* ${formatCurrency(unitPrice)}`,
      `💵 *Total Pago:* ${formatCurrency(total)}`,
      `💳 *Forma de Pagamento:* ${sale.paymentMethod || 'Pix'}`,
      `📱 *Canal:* ${sale.channel || 'WhatsApp'}`,
    ];

    if (sale.customerName?.trim()) {
      text.push(`👤 *Cliente:* ${sale.customerName.trim()}`);
    }
    text.push(`📅 *Data:* ${formatDateTime(sale.date)}`);

    if (sale.reason.includes('Obs:')) {
      const obs = sale.reason.split('Obs:')[1]?.trim();
      if (obs) text.push(`📝 *Obs:* ${obs}`);
    }

    text.push(``);
    text.push(`Obrigado pela preferência e confiança na Trigon! ✨🔺`);

    try {
      await navigator.clipboard.writeText(text.join('\n'));
      setCopiedId(sale.id);
      setTimeout(() => setCopiedId(null), 2500);
      success('Comprovante copiado para a área de transferência!');
    } catch {
      error('Não foi possível copiar o texto.');
    }
  };

  const handleOpenCustomerVault = (customerId?: string) => {
    if (!customerId) return;
    const found = customerMap.get(customerId);
    if (found) {
      setSelectedCustomerForVault(found);
      setIsVaultOpen(true);
    } else {
      error('Cliente não encontrado.');
    }
  };

  return (
    <div className="space-y-7">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-crimson-950/70 border border-crimson-600/40 flex items-center justify-center text-crimson-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
                Histórico de Vendas
              </h1>
              <p className="text-xs sm:text-sm text-trigon-400 mt-0.5">
                Rastreabilidade completa de todas as vendas, negociações e envios
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            loading={loading}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Atualizar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRecordSaleOpen(true)}
            icon={<ShoppingCart className="w-4 h-4" />}
          >
            Lançar Venda
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Faturamento */}
        <div className="p-4 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md">
          <p className="text-[11px] uppercase font-semibold text-emerald-400 tracking-wider">
            Faturamento
          </p>
          <p className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">
            {formatCurrency(metrics.totalRevenue)}
          </p>
          <p className="text-[10px] text-trigon-500 mt-0.5">Nas vendas filtradas</p>
        </div>

        {/* Itens Vendidos */}
        <div className="p-4 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md">
          <p className="text-[11px] uppercase font-semibold text-amber-400 tracking-wider">
            Itens Vendidos
          </p>
          <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
            {metrics.totalUnits} un.
          </p>
          <p className="text-[10px] text-trigon-500 mt-0.5">Unidades totais</p>
        </div>

        {/* Total Vendas */}
        <div className="p-4 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md">
          <p className="text-[11px] uppercase font-semibold text-trigon-300 tracking-wider">
            Total Vendas
          </p>
          <p className="text-xl sm:text-2xl font-black text-white mt-1">
            {metrics.salesCount}
          </p>
          <p className="text-[10px] text-trigon-500 mt-0.5">Transações</p>
        </div>

        {/* Ticket Médio */}
        <div className="p-4 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md">
          <p className="text-[11px] uppercase font-semibold text-sky-400 tracking-wider">
            Ticket Médio
          </p>
          <p className="text-xl sm:text-2xl font-black text-sky-400 mt-1 font-mono">
            {formatCurrency(metrics.averageTicket)}
          </p>
          <p className="text-[10px] text-trigon-500 mt-0.5">Por transação</p>
        </div>

        {/* Descontos Concedidos */}
        <div className="p-4 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md">
          <p className="text-[11px] uppercase font-semibold text-orange-400 tracking-wider">
            Descontos
          </p>
          <p className="text-xl sm:text-2xl font-black text-orange-400 mt-1 font-mono">
            {formatCurrency(metrics.totalDiscount)}
          </p>
          <p className="text-[10px] text-trigon-500 mt-0.5">Abaixo da tabela</p>
        </div>

        {/* Clientes / Gaveta */}
        <div className="p-4 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md">
          <p className="text-[11px] uppercase font-semibold text-purple-400 tracking-wider">
            Com Cliente
          </p>
          <p className="text-xl sm:text-2xl font-black text-purple-300 mt-1">
            {metrics.totalVaultSales}
          </p>
          <p className="text-[10px] text-trigon-500 mt-0.5">Vinculadas a cliente</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-trigon-900 border border-trigon-800 space-y-3 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-trigon-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por produto, cliente, canal, pagamento ou obs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-xs sm:text-sm text-white placeholder-trigon-500 focus:outline-none focus:border-crimson-500"
            />
          </div>

          {/* Period Filter */}
          <div>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-xs sm:text-sm text-white focus:outline-none focus:border-crimson-500"
            >
              <option value="ALL">Todo o Período</option>
              <option value="TODAY">Hoje</option>
              <option value="WEEK">Últimos 7 dias</option>
              <option value="MONTH">Este Mês</option>
            </select>
          </div>

          {/* Channel Filter */}
          <div>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-xs sm:text-sm text-white focus:outline-none focus:border-crimson-500"
            >
              <option value="ALL">Todos os Canais</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Instagram">Instagram</option>
              <option value="Jamble">Jamble</option>
              <option value="Outro Canal">Outro Canal</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-xs sm:text-sm text-white focus:outline-none focus:border-crimson-500"
            >
              <option value="ALL">Todas as Formas</option>
              <option value="Pix">Pix</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Transferência">Transferência</option>
            </select>
          </div>
        </div>

        {/* Customer Select & Clear */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-trigon-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs text-trigon-400 font-medium">Filtrar por Cliente:</span>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-trigon-950 border border-trigon-750 text-xs text-white focus:outline-none focus:border-crimson-500 max-w-xs truncate"
            >
              <option value="ALL">Todos os Clientes</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {(searchTerm ||
            selectedChannel !== 'ALL' ||
            selectedPayment !== 'ALL' ||
            selectedCustomerId !== 'ALL' ||
            selectedPeriod !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedChannel('ALL');
                setSelectedPayment('ALL');
                setSelectedCustomerId('ALL');
                setSelectedPeriod('ALL');
              }}
              className="text-xs text-crimson-400 hover:text-crimson-300 transition-colors font-medium self-end sm:self-center"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Sales List Table */}
      <div className="rounded-2xl bg-trigon-900 border border-trigon-800 overflow-hidden shadow-lg">
        <div className="p-4 sm:p-5 border-b border-trigon-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-cinzel text-sm sm:text-base font-bold text-white uppercase tracking-wider">
              Vendas Registradas ({filteredSales.length})
            </h3>
          </div>
          <span className="text-xs text-trigon-400">
            Total: <strong className="text-emerald-400 font-mono">{formatCurrency(metrics.totalRevenue)}</strong>
          </span>
        </div>

        {filteredSales.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ShoppingCart className="w-12 h-12 text-trigon-600 mx-auto" />
            <p className="text-white font-medium text-sm">Nenhuma venda encontrada com os filtros selecionados.</p>
            <p className="text-xs text-trigon-400">
              Clique em &quot;Lançar Venda&quot; para registrar novas transações.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-trigon-950/80 text-trigon-400 uppercase tracking-wider border-b border-trigon-800 text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Data / Hora</th>
                  <th className="py-3.5 px-4 font-semibold">Produto</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Qtd</th>
                  <th className="py-3.5 px-4 font-semibold">Preço Praticado</th>
                  <th className="py-3.5 px-4 font-semibold">Total Venda</th>
                  <th className="py-3.5 px-4 font-semibold">Cliente</th>
                  <th className="py-3.5 px-4 font-semibold">Canal / Pagto</th>
                  <th className="py-3.5 px-4 font-semibold">Detalhes</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trigon-800/80">
                {filteredSales.map((sale) => {
                  const prod = productMap.get(sale.productId);
                  const prodName = prod?.name || sale.productName;
                  const prodImage = prod?.images?.[0];
                  const catalogPrice = sale.originalPrice || prod?.price || 0;
                  const unitPrice = sale.unitPrice || catalogPrice;
                  const lineTotal = sale.totalValue || unitPrice * sale.quantity;
                  const priceDiff = unitPrice - catalogPrice;
                  const hasCustomer = Boolean(sale.customerId);
                  const isCopied = copiedId === sale.id;

                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-trigon-850/60 transition-colors group"
                    >
                      {/* Data / Hora */}
                      <td className="py-3 px-4 text-trigon-300 whitespace-nowrap">
                        <span className="font-mono text-[11px] block text-white font-medium">
                          {formatDateTime(sale.date).split(' ')[0]}
                        </span>
                        <span className="text-[10px] text-trigon-500 font-mono">
                          {formatDateTime(sale.date).split(' ')[1] || ''}
                        </span>
                      </td>

                      {/* Produto com miniatura */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className="w-10 h-12 rounded-lg bg-black/50 border border-trigon-750 overflow-hidden shrink-0 flex items-center justify-center">
                            {prodImage ? (
                              <img
                                src={prodImage}
                                alt={prodName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-trigon-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white leading-tight truncate">
                              {prodName}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {prod?.rarity && (
                                <span className="text-[10px] text-trigon-400">
                                  {prod.rarity}
                                </span>
                              )}
                              {prod?.condition && (
                                <span className="text-[10px] text-trigon-500">
                                  • {prod.condition}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Quantidade */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-trigon-950 border border-trigon-750 font-bold text-white text-xs">
                          {sale.quantity}x
                        </span>
                      </td>

                      {/* Preço Unitário & Variação */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-white text-xs">
                          {formatCurrency(unitPrice)}
                        </div>
                        {priceDiff === 0 ? (
                          <span className="text-[10px] text-emerald-400">Tabela</span>
                        ) : priceDiff < 0 ? (
                          <span className="text-[10px] text-amber-400 font-medium">
                            {formatCurrency(priceDiff)} desc.
                          </span>
                        ) : (
                          <span className="text-[10px] text-sky-400 font-medium">
                            +{formatCurrency(priceDiff)} ágio
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-black text-emerald-400 text-sm">
                          {formatCurrency(lineTotal)}
                        </span>
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {sale.customerName ? (
                          <div className="space-y-1">
                            <span className="font-semibold text-white block">
                              {sale.customerName}
                            </span>
                            {hasCustomer && (
                              <button
                                type="button"
                                onClick={() => handleOpenCustomerVault(sale.customerId)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-crimson-950/60 border border-crimson-600/40 text-[10px] text-crimson-300 hover:text-white hover:bg-crimson-900 transition-colors"
                                title="Abrir Gaveta de Envio do Cliente"
                              >
                                <Archive className="w-2.5 h-2.5" />
                                <span>Ver Gaveta</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-trigon-500 italic text-[11px]">Avulso / Balcão</span>
                        )}
                      </td>

                      {/* Canal & Pagamento */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-trigon-950 border border-trigon-750 text-[10px] text-trigon-300 font-medium">
                            {sale.channel || 'WhatsApp'}
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold block w-fit">
                            {sale.paymentMethod || 'Pix'}
                          </span>
                        </div>
                      </td>

                      {/* Detalhes / Obs */}
                      <td className="py-3 px-4 text-trigon-400 max-w-[180px]">
                        <p className="line-clamp-2 text-[11px]">
                          {sale.reason}
                        </p>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopySaleReceipt(sale)}
                            className="p-1.5 rounded-lg bg-trigon-950 border border-trigon-750 text-trigon-300 hover:text-white hover:border-trigon-600 transition-colors"
                            title="Copiar Recibo WhatsApp"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {hasCustomer && (
                            <button
                              type="button"
                              onClick={() => handleOpenCustomerVault(sale.customerId)}
                              className="p-1.5 rounded-lg bg-crimson-950/60 border border-crimson-600/40 text-crimson-300 hover:text-white hover:bg-crimson-900 transition-colors"
                              title="Abrir Gaveta deste cliente"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Lançar Venda */}
      <RecordSaleModal
        isOpen={isRecordSaleOpen}
        onClose={() => setIsRecordSaleOpen(false)}
        products={products}
        onSaleSuccess={() => {
          loadData();
        }}
      />

      {/* Modal Gaveta do Cliente */}
      <CustomerVaultModal
        isOpen={isVaultOpen}
        onClose={() => {
          setIsVaultOpen(false);
          setSelectedCustomerForVault(null);
        }}
        customer={selectedCustomerForVault}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
};
