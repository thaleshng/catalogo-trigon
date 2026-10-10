import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardStats, StockMovement, Product } from '../../types';
import { stockService } from '../../services/stockService';
import { productService } from '../../services/productService';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { RecordSaleModal } from '../../components/admin/RecordSaleModal';
import {
  Package,
  Layers,
  CheckCircle,
  AlertOctagon,
  TrendingUp,
  ArrowRight,
  ArrowLeftRight,
  PlusCircle,
  AlertTriangle,
  ShoppingCart,
  DollarSign,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardStats, movements, products] = await Promise.all([
        stockService.getStats(),
        stockService.getMovements(5),
        productService.getProducts(),
      ]);
      setStats(dashboardStats);
      setRecentMovements(movements);
      setAllProducts(products);

      // Identifica produtos com estoque baixo (<= 2 ou zerados)
      const low = products
        .filter((p) => p.stockQuantity <= 2)
        .slice(0, 5);
      setLowStockProducts(low);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-trigon-900 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-trigon-900 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
            Dashboard Administrativo
          </h1>
          <p className="text-sm text-trigon-400 mt-1">
            Visão geral do inventário, coleções e movimentações da TRIGON
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsSaleModalOpen(true)}
            icon={<ShoppingCart className="w-4 h-4" />}
          >
            Lançar Venda
          </Button>
          <Link to="/admin/produtos">
            <Button variant="outline" size="sm" icon={<PlusCircle className="w-4 h-4" />}>
              Novo Produto
            </Button>
          </Link>
          <Link to="/admin/colecoes">
            <Button variant="outline" size="sm" icon={<Layers className="w-4 h-4" />}>
              Nova Coleção
            </Button>
          </Link>
          <Link to="/admin/estoque">
            <Button variant="secondary" size="sm" icon={<ArrowLeftRight className="w-4 h-4" />}>
              Movimentar Estoque
            </Button>
          </Link>
        </div>
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Products */}
        <div className="p-5 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-semibold text-trigon-400 tracking-wider">
              Total Produtos
            </p>
            <p className="text-2xl font-extrabold text-white mt-1">
              {stats.totalProducts}
            </p>
            <p className="text-[11px] text-trigon-500 mt-0.5">No catálogo</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-trigon-800/80 border border-trigon-700 flex items-center justify-center text-trigon-300">
            <Package className="w-5 h-5 text-crimson-400" />
          </div>
        </div>

        {/* Available Products */}
        <div className="p-5 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-semibold text-emerald-400 tracking-wider">
              Disponíveis
            </p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">
              {stats.availableProducts}
            </p>
            <p className="text-[11px] text-trigon-500 mt-0.5">Em estoque</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Out of Stock */}
        <div className="p-5 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-semibold text-red-400 tracking-wider">
              Esgotados
            </p>
            <p className="text-2xl font-extrabold text-red-400 mt-1">
              {stats.outOfStockProducts}
            </p>
            <p className="text-[11px] text-trigon-500 mt-0.5">Sem estoque</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        {/* Total Collections */}
        <div className="p-5 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-semibold text-trigon-400 tracking-wider">
              Coleções
            </p>
            <p className="text-2xl font-extrabold text-white mt-1">
              {stats.totalCollections}
            </p>
            <p className="text-[11px] text-trigon-500 mt-0.5">Categorias ativas</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-trigon-800/80 border border-trigon-700 flex items-center justify-center text-trigon-300">
            <Layers className="w-5 h-5 text-crimson-400" />
          </div>
        </div>

        {/* Total Sales Count */}
        <div className="p-5 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-semibold text-amber-400 tracking-wider">
              Itens Vendidos
            </p>
            <p className="text-2xl font-extrabold text-amber-400 mt-1">
              {stats.totalSalesCount} un.
            </p>
            <p className="text-[11px] text-trigon-500 mt-0.5">Vendas lançadas</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        {/* Total Sales Revenue */}
        <div className="p-5 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-semibold text-emerald-400 tracking-wider">
              Faturamento
            </p>
            <p className="text-2xl font-extrabold text-white mt-1">
              {formatCurrency(stats.totalRevenue)}
            </p>
            <p className="text-[11px] text-emerald-500 mt-0.5">Receita de vendas</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Total Valuation Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-trigon-900 via-trigon-850 to-crimson-950/40 border border-trigon-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-crimson-950/80 border border-crimson-600/40 text-crimson-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-trigon-400 tracking-wider">
              Valor Total Estimado em Inventário
            </p>
            <p className="text-2xl sm:text-3xl font-black text-white mt-0.5">
              {formatCurrency(stats.totalStockValue)}
            </p>
          </div>
        </div>

        <Link
          to="/admin/estoque"
          className="inline-flex items-center gap-2 text-xs font-semibold text-crimson-400 hover:text-crimson-300"
        >
          <span>Gerenciar Movimentações</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Two Column Layout: Recent Movements & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Movements */}
        <div className="p-6 rounded-2xl bg-trigon-900 border border-trigon-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-white flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-crimson-400" />
              <span>Últimas Movimentações de Estoque</span>
            </h3>
            <Link
              to="/admin/estoque"
              className="text-xs text-crimson-400 hover:underline"
            >
              Ver Todas
            </Link>
          </div>

          {recentMovements.length === 0 ? (
            <p className="text-sm text-trigon-500 py-4">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="divide-y divide-trigon-800">
              {recentMovements.map((mov) => (
                <div key={mov.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate max-w-xs">
                      {mov.productName}
                    </p>
                    <p className="text-xs text-trigon-500">
                      {mov.reason} • {formatDateTime(mov.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={mov.type === 'ENTRADA' ? 'success' : 'danger'}>
                      {mov.type === 'ENTRADA' ? `+${mov.quantity}` : `-${mov.quantity}`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="p-6 rounded-2xl bg-trigon-900 border border-trigon-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Alertas de Estoque Baixo ou Esgotado</span>
            </h3>
            <Link
              to="/admin/produtos"
              className="text-xs text-crimson-400 hover:underline"
            >
              Ver Produtos
            </Link>
          </div>

          {lowStockProducts.length === 0 ? (
            <p className="text-sm text-emerald-400 py-4">Todos os produtos possuem estoque saudável!</p>
          ) : (
            <div className="divide-y divide-trigon-800">
              {lowStockProducts.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate max-w-xs">
                      {p.name}
                    </p>
                    <p className="text-xs text-trigon-500">
                      Preço: {formatCurrency(p.price)}
                    </p>
                  </div>
                    <div>
                      {p.stockQuantity === 0 ? (
                        <Badge variant="danger" size="sm" dot>
                          Esgotado
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm" dot>
                          Restam {p.stockQuantity} un.
                        </Badge>
                      )}
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Lançar Venda */}
      <RecordSaleModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        products={allProducts}
        onSaleSuccess={() => {
          loadDashboardData();
        }}
      />
    </div>
  );
};
