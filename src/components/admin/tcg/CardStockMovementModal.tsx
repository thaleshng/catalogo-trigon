import React, { useEffect, useState } from 'react';
import { TcgCardVariant, TcgCardStockMovementType } from '../../../types';
import { cardStockService } from '../../../services/cardStockService';
import { formatCardNumber } from '../../../services/tcgdexService';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { useToast } from '../../common/Toast';
import { CardThumbnail } from './CardThumbnail';
import {
  CardConditionBadge,
  CardLanguageBadge,
  CardFinishBadge,
} from './CardAttributeBadges';
import {
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
} from 'lucide-react';

interface CardStockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: TcgCardVariant | null;
  defaultType?: TcgCardStockMovementType;
  onMovementRecorded: (updatedVariant: TcgCardVariant) => void;
}

export const CardStockMovementModal: React.FC<CardStockMovementModalProps> = ({
  isOpen,
  onClose,
  variant,
  defaultType = 'ENTRADA',
  onMovementRecorded,
}) => {
  const [movementType, setMovementType] = useState<TcgCardStockMovementType>(defaultType);
  const [adjustmentDirection, setAdjustmentDirection] = useState<'ADD' | 'SUBTRACT'>('SUBTRACT');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCostStr, setUnitCostStr] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { success, error } = useToast();

  useEffect(() => {
    if (!isOpen || !variant) return;
    setMovementType(defaultType);
    setAdjustmentDirection('SUBTRACT');
    setQuantity(1);
    setUnitCostStr('');
    setReason(
      defaultType === 'ENTRADA'
        ? 'Recebimento de lote adicional'
        : defaultType === 'SAIDA'
          ? 'Baixa de venda / saída de estoque'
          : 'Ajuste de conferência física'
    );
  }, [isOpen, variant, defaultType]);

  if (!isOpen || !variant) return null;

  const isAdding =
    movementType === 'ENTRADA' ||
    (movementType === 'AJUSTE' && adjustmentDirection === 'ADD');

  const previewStock = isAdding
    ? variant.quantity + quantity
    : Math.max(0, variant.quantity - quantity);

  const wouldBeNegative = !isAdding && variant.quantity < quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!Number.isInteger(quantity) || quantity <= 0) {
      error('A quantidade deve ser um número inteiro maior que zero.');
      return;
    }

    if (wouldBeNegative) {
      error(
        `Saldo insuficiente nesta variante! Disponível: ${variant.quantity} un., solicitado: ${quantity} un.`
      );
      return;
    }

    if (!reason.trim()) {
      error('Informe o motivo da movimentação.');
      return;
    }

    try {
      setSubmitting(true);
      let unitCost: number | null = null;
      if (unitCostStr.trim() !== '') {
        const parsed = Number(unitCostStr.replace(',', '.'));
        if (Number.isNaN(parsed) || parsed < 0) {
          error('Custo unitário inválido.');
          setSubmitting(false);
          return;
        }
        unitCost = Math.round(parsed * 100) / 100;
      }

      const finalReason =
        movementType === 'AJUSTE'
          ? `[Ajuste ${adjustmentDirection === 'ADD' ? '+' : '-'}] ${reason.trim()}`
          : reason.trim();

      const { variant: updatedVariant } = await cardStockService.recordMovement({
        variantId: variant.id,
        type: movementType,
        quantity,
        reason: finalReason,
        unitCost: movementType === 'ENTRADA' ? unitCost : null,
        adjustmentDirection: movementType === 'AJUSTE' ? adjustmentDirection : undefined,
      });

      success(
        `Movimentação registrada! Novo saldo da variante: ${updatedVariant.quantity} un.`
      );
      onMovementRecorded(updatedVariant);
      onClose();
    } catch (err: any) {
      error(err.message || 'Erro ao registrar movimentação da variante');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStep = async (type: 'ENTRADA' | 'SAIDA') => {
    if (type === 'SAIDA' && variant.quantity < 1) {
      error('Saldo insuficiente para saída rápida.');
      return;
    }
    try {
      setSubmitting(true);
      const { variant: updatedVariant } = await cardStockService.recordMovement({
        variantId: variant.id,
        type,
        quantity: 1,
        reason:
          type === 'ENTRADA'
            ? 'Entrada rápida (+1 un.)'
            : 'Saída rápida (-1 un.)',
      });
      success(`Estoque atualizado para ${updatedVariant.quantity} un.`);
      onMovementRecorded(updatedVariant);
      onClose();
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar estoque');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Controlar Estoque da Variante"
      description="Realize ajustes rápidos (-1 / +1) ou registre entradas, saídas e ajustes detalhados."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Identificação da Variante + Ajuste Rápido */}
        <div className="p-3.5 rounded-xl bg-trigon-950 border border-trigon-800 flex items-center gap-3.5">
          <CardThumbnail
            image={variant.card?.imageUrl}
            alt={variant.card?.name || 'Carta'}
            quality="low"
            size="sm"
          />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-bold text-white text-sm truncate">
              {variant.card?.name || 'Carta TCG'}{' '}
              <span className="font-mono text-xs text-trigon-400">
                (
                {formatCardNumber(
                  variant.card?.localId,
                  variant.card?.totalCards
                )}
                )
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <CardConditionBadge value={variant.condition} size="sm" />
              <CardLanguageBadge value={variant.language} size="sm" />
              <CardFinishBadge value={variant.finish} size="sm" />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={submitting || variant.quantity < 1}
              onClick={() => handleQuickStep('SAIDA')}
              className="px-2.5 py-1.5 rounded-lg bg-trigon-900 hover:bg-red-950/70 border border-trigon-750 hover:border-red-500/50 text-red-400 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Saída rápida de 1 unidade"
            >
              -1
            </button>
            <div className="text-center px-2">
              <span className="text-[10px] uppercase text-trigon-400 block">Saldo</span>
              <span className="font-mono font-bold text-base text-white">
                {variant.quantity} un.
              </span>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleQuickStep('ENTRADA')}
              className="px-2.5 py-1.5 rounded-lg bg-trigon-900 hover:bg-emerald-950/70 border border-trigon-750 hover:border-emerald-500/50 text-emerald-400 text-xs font-bold disabled:opacity-30 transition-colors"
              title="Entrada rápida de 1 unidade"
            >
              +1
            </button>
          </div>
        </div>

        {/* Tipo de Movimentação */}
        <div>
          <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
            Tipo de Operação *
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMovementType('ENTRADA');
                setReason('Recebimento de lote adicional');
              }}
              className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
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
              onClick={() => {
                setMovementType('SAIDA');
                setReason('Saída / Venda de unidades');
              }}
              className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                movementType === 'SAIDA'
                  ? 'bg-red-950/80 border-red-500 text-red-300 shadow-md'
                  : 'bg-trigon-950 border-trigon-750 text-trigon-400 hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 text-red-400" />
              <span>Saída (-)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMovementType('AJUSTE');
                setReason('Ajuste de inventário físico');
              }}
              className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                movementType === 'AJUSTE'
                  ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-md'
                  : 'bg-trigon-950 border-trigon-750 text-trigon-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span>Ajuste</span>
            </button>
          </div>
        </div>

        {/* Direção do Ajuste quando AJUSTE está selecionado */}
        {movementType === 'AJUSTE' && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setAdjustmentDirection('SUBTRACT')}
              className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                adjustmentDirection === 'SUBTRACT'
                  ? 'bg-red-950/60 border-red-500/60 text-red-200'
                  : 'bg-trigon-950 border-trigon-800 text-trigon-400'
              }`}
            >
              Reduzir Saldo (-)
            </button>
            <button
              type="button"
              onClick={() => setAdjustmentDirection('ADD')}
              className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                adjustmentDirection === 'ADD'
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                  : 'bg-trigon-950 border-trigon-800 text-trigon-400'
              }`}
            >
              Aumentar Saldo (+)
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
              Quantidade *
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm font-bold focus:outline-none focus:border-crimson-500"
              required
            />
          </div>

          {movementType === 'ENTRADA' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
                Custo Unitário (R$ - Opcional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitCostStr}
                onChange={(e) => setUnitCostStr(e.target.value)}
                placeholder="Opcional — Ex: 15.00"
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
            Motivo da Movimentação *
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Venda no balcão, entrada de compra, conferência física..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
            required
          />
        </div>

        {/* Prévia de Saldo */}
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            wouldBeNegative
              ? 'bg-red-950/40 border-red-500/50 text-red-200'
              : 'bg-trigon-950 border-trigon-800'
          }`}
        >
          <div>
            <span className="text-trigon-400 block">Saldo Anterior:</span>
            <span className="font-bold text-white font-mono">{variant.quantity} un.</span>
          </div>
          <div className="text-trigon-500 font-bold">➔</div>
          <div className="text-right">
            <span className="text-trigon-400 block">Novo Saldo:</span>
            {wouldBeNegative ? (
              <span className="font-bold text-red-400">
                Saldo insuficiente (mínimo 0)
              </span>
            ) : (
              <span className="font-bold text-emerald-400 text-sm font-mono">
                {previewStock} un.
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-trigon-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={wouldBeNegative}
          >
            Confirmar Movimentação
          </Button>
        </div>
      </form>
    </Modal>
  );
};

