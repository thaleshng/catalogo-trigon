import React from 'react';
import { AuctionDashboardStats, TcgAuction } from '../../../../types';
import { formatCurrency, formatDate } from '../../../../utils/formatters';
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Package,
  Layers,
  Percent,
  Calendar,
} from 'lucide-react';

interface AuctionDashboardTabProps {
  stats: AuctionDashboardStats;
  recentAuctions: TcgAuction[];
  onOpenAuction: (auctionId: string) => void;
  onNewAuction: () => void;
}

export const AuctionDashboardTab: React.FC<AuctionDashboardTabProps> = ({
  stats,
  recentAuctions,
  onOpenAuction,
  onNewAuction,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. Grade de Indicadores Financeiros Consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Faturado / Arrematado */}
        <div className="p-4 rounded-2xl bg-trigon-950 border border-trigon-800 relative overflow-hidden shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-trigon-400">
              Total Arrematado
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-emerald-400">
              {formatCurrency(stats.totalArrematadoValue)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-trigon-500">
            Soma de todos os arremates realizados
          </p>
        </div>

        {/* Total Pago / Recebido */}
        <div className="p-4 rounded-2xl bg-trigon-950 border border-trigon-800 relative overflow-hidden shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-trigon-400">
              Total Pago
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-blue-400">
              {formatCurrency(stats.totalPaidValue)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-trigon-500">
            Valores já recebidos e confirmados
          </p>
        </div>

        {/* Total Pendente */}
        <div className="p-4 rounded-2xl bg-trigon-950 border border-trigon-800 relative overflow-hidden shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-trigon-400">
              Pendente de Pagamento
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-950/80 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-amber-300">
              {formatCurrency(stats.totalPendingValue)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-trigon-500">
            Arremates em cobrança ou vencidos
          </p>
        </div>

        {/* Lucro Estimado */}
        <div className="p-4 rounded-2xl bg-trigon-950 border border-trigon-800 relative overflow-hidden shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-trigon-400">
              Lucro Estimado
            </span>
            <div className="w-8 h-8 rounded-xl bg-crimson-950/80 border border-crimson-500/30 flex items-center justify-center text-crimson-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`font-mono text-2xl font-bold ${
                stats.totalProfitValue >= 0 ? 'text-emerald-400' : 'text-crimson-400'
              }`}
            >
              {formatCurrency(stats.totalProfitValue)}
            </span>
            <span className="text-xs font-medium text-trigon-400">
              ({stats.profitMargin.toFixed(1)}%)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-trigon-500">
            Arrematado − Custo das cartas arrematadas
          </p>
        </div>
      </div>

      {/* 2. Métricas Operacionais e Taxa de Conversão */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Taxa de Arremate */}
        <div className="p-5 rounded-2xl bg-trigon-950 border border-trigon-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-trigon-300 flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-400" />
                <span>Taxa de Arremate</span>
              </span>
              <span className="font-mono text-lg font-bold text-emerald-400">
                {stats.conversionRate.toFixed(1)}%
              </span>
            </div>
            {/* Barra de Progresso */}
            <div className="w-full h-3 rounded-full bg-trigon-900 overflow-hidden p-0.5 border border-trigon-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${Math.min(100, stats.conversionRate)}%` }}
              />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-trigon-850 flex justify-between text-xs text-trigon-400">
            <span>
              Arrematadas: <strong className="text-white">{stats.totalArrematados}</strong>
            </span>
            <span>
              Não Arrematadas:{' '}
              <strong className="text-white">{stats.totalNaoArrematados}</strong>
            </span>
          </div>
        </div>

        {/* Volume de Lotes */}
        <div className="p-5 rounded-2xl bg-trigon-950 border border-trigon-800 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-trigon-300 flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Volume Total de Itens</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold text-white">
                {stats.totalItems}
              </span>
              <span className="text-xs text-trigon-400">lotes leiloados</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-trigon-850 flex justify-between text-xs text-trigon-400">
            <span>
              Total de Leilões: <strong className="text-white">{stats.totalAuctions}</strong>
            </span>
            <span>
              Média/Leilão:{' '}
              <strong className="text-white">
                {stats.totalAuctions > 0
                  ? Math.round(stats.totalItems / stats.totalAuctions)
                  : 0}{' '}
                lotes
              </strong>
            </span>
          </div>
        </div>

        {/* Custo Consolidado */}
        <div className="p-5 rounded-2xl bg-trigon-950 border border-trigon-800 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-trigon-300 flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-amber-400" />
              <span>Custo de Aquisição dos Lotes</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-amber-300">
                {formatCurrency(stats.totalCostValue)}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-trigon-850 flex justify-between text-xs text-trigon-400">
            <span>
              Arrematado: <strong className="text-white">{formatCurrency(stats.totalArrematadoValue)}</strong>
            </span>
            <span>
              Margem:{' '}
              <strong className="text-emerald-400">{stats.profitMargin.toFixed(1)}%</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Últimos Leilões Realizados */}
      <div className="p-6 rounded-2xl bg-trigon-950 border border-trigon-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-crimson-400" />
            <h3 className="font-cinzel text-base font-bold text-white">
              Leilões Recentes
            </h3>
          </div>
          <button
            type="button"
            onClick={onNewAuction}
            className="text-xs font-semibold text-crimson-400 hover:text-crimson-300 underline"
          >
            + Criar Novo Pré-Leilão
          </button>
        </div>

        {recentAuctions.length === 0 ? (
          <div className="py-8 text-center text-sm text-trigon-500">
            Nenhum leilão cadastrado ainda. Crie um novo leilão ou registre leilões passados!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-trigon-800 text-trigon-400 uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Leilão</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Período</th>
                  <th className="pb-3 font-semibold">Lotes</th>
                  <th className="pb-3 font-semibold">Arrematado</th>
                  <th className="pb-3 font-semibold">Pendente</th>
                  <th className="pb-3 font-semibold">Lucro</th>
                  <th className="pb-3 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trigon-850">
                {recentAuctions.slice(0, 5).map((auc) => (
                  <tr key={auc.id} className="hover:bg-trigon-900/50 transition-colors">
                    <td className="py-3">
                      <span className="font-cinzel font-bold text-white block">
                        #{auc.code}
                      </span>
                      <span className="text-[11px] text-trigon-400 truncate max-w-[150px] block">
                        {auc.title}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          auc.status === 'EM_ANDAMENTO'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                            : auc.status === 'FINALIZADO'
                              ? 'bg-trigon-850 text-trigon-300 border border-trigon-700'
                              : 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {auc.status === 'EM_ANDAMENTO'
                          ? '● EM LEILÃO'
                          : auc.status === 'FINALIZADO'
                            ? 'FINALIZADO'
                            : 'PRÉ-LEILÃO'}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[11px] text-trigon-300">
                      {formatDate(auc.startDate)}
                    </td>
                    <td className="py-3">
                      <span className="font-mono text-white font-semibold">
                        {auc.arrematadosCount || 0} / {auc.itemsCount || 0}
                      </span>
                    </td>
                    <td className="py-3 font-mono font-semibold text-emerald-400">
                      {formatCurrency(auc.totalArrematado || 0)}
                    </td>
                    <td className="py-3 font-mono font-semibold text-amber-300">
                      {formatCurrency(auc.totalPendente || 0)}
                    </td>
                    <td className="py-3 font-mono font-semibold text-emerald-400">
                      {formatCurrency(auc.totalLucro || 0)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenAuction(auc.id)}
                        className="px-3 py-1.5 rounded-lg bg-trigon-900 hover:bg-crimson-900/40 border border-trigon-750 hover:border-crimson-500/50 text-xs font-medium text-white transition-all"
                      >
                        Gerenciar Lotes →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
