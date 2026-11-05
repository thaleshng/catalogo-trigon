import React, { useEffect, useState } from 'react';
import {
  TcgdexCardDetail,
  TcgCardVariant,
} from '../../../types';
import {
  getCardConditionOptions,
  getCardLanguageOptions,
  getCardFinishOptions,
  buildLigaPokemonUrl,
} from '../../../config/tcgCardOptions';
import { cardStockService } from '../../../services/cardStockService';
import { formatCurrency } from '../../../utils/formatters';
import { formatCardNumber } from '../../../services/tcgdexService';
import { inferCardDefaultLanguage, translateAsianPokemonName } from '../../../config/tcgSetTranslations';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { Badge } from '../../common/Badge';
import { useToast } from '../../common/Toast';
import { CardThumbnail } from './CardThumbnail';
import {
  CardConditionBadge,
  CardLanguageBadge,
  CardFinishBadge,
} from './CardAttributeBadges';
import {
  Plus,
  CheckCircle2,
  ExternalLink,
  PackagePlus,
  ArrowRight,
} from 'lucide-react';

interface CardVariantFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardDetail: TcgdexCardDetail | null;
  customLigaUrl?: string | null;
  onSuccess: (variant: TcgCardVariant) => void;
  onOpenInStock?: (tcgdexId: string) => void;
}

export const CardVariantFormModal: React.FC<CardVariantFormModalProps> = ({
  isOpen,
  onClose,
  cardDetail,
  customLigaUrl,
  onSuccess,
  onOpenInStock,
}) => {
  const conditionOptions = getCardConditionOptions();
  const languageOptions = getCardLanguageOptions();
  const finishOptions = getCardFinishOptions();

  const [quantity, setQuantity] = useState<number>(1);
  const [condition, setCondition] = useState<string>(
    conditionOptions[1]?.value || conditionOptions[0]?.value || 'NM'
  );
  const [language, setLanguage] = useState<string>(
    languageOptions[0]?.value || 'PT'
  );
  const [finish, setFinish] = useState<string>(
    finishOptions[0]?.value || 'NORMAL'
  );
  const [isLanguageAutoDetected, setIsLanguageAutoDetected] = useState<boolean>(false);

  // Campos financeiros opcionais (strings vazias representam NULL)
  const [acquisitionCostStr, setAcquisitionCostStr] = useState<string>('');
  const [referenceValueStr, setReferenceValueStr] = useState<string>('');
  const [salePriceStr, setSalePriceStr] = useState<string>('');
  const [referenceDateStr, setReferenceDateStr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Detecção de variante já existente
  const [existingVariant, setExistingVariant] = useState<TcgCardVariant | null>(
    null
  );
  const [checkingExisting, setCheckingExisting] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Estado pós-cadastro
  const [savedVariantResult, setSavedVariantResult] = useState<{
    variant: TcgCardVariant;
    status: 'CREATED' | 'ADDED_TO_EXISTING';
  } | null>(null);

  const { success, error } = useToast();

  // Inicializa o formulário ao abrir com uma carta
  useEffect(() => {
    if (!isOpen || !cardDetail) {
      setSavedVariantResult(null);
      setExistingVariant(null);
      return;
    }

    setSavedVariantResult(null);
    setQuantity(1);
    setCondition(
      conditionOptions[1]?.value || conditionOptions[0]?.value || 'NM'
    );
    
    // Auto-detecção inteligente do idioma da carta a partir da coleção/origem
    const detectedLang = inferCardDefaultLanguage(cardDetail);
    setLanguage(detectedLang || languageOptions[0]?.value || 'PT');
    setIsLanguageAutoDetected(Boolean(detectedLang));

    if (cardDetail.variants?.holo && !cardDetail.variants?.normal) {
      setFinish('FOIL');
    } else {
      setFinish('NORMAL');
    }

    setAcquisitionCostStr('');
    setReferenceValueStr('');
    setSalePriceStr('');
    setReferenceDateStr('');
    setNotes('');
  }, [isOpen, cardDetail]);

  // Verifica em tempo real se a combinação (carta + condição + idioma + acabamento) já existe no estoque
  useEffect(() => {
    if (!isOpen || !cardDetail || !condition || !language || !finish) {
      setExistingVariant(null);
      return;
    }

    let cancelled = false;
    setCheckingExisting(true);

    cardStockService
      .findExistingVariant({
        tcgdexId: cardDetail.id,
        condition,
        language,
        finish,
      })
      .then((found) => {
        if (!cancelled) {
          setExistingVariant(found);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExistingVariant(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingExisting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, cardDetail, condition, language, finish]);

  if (!isOpen || !cardDetail) return null;

  const totalSetCards =
    cardDetail.set?.cardCount?.official ?? cardDetail.set?.cardCount?.total ?? null;
  const formattedNumber = formatCardNumber(cardDetail.localId, totalSetCards);
  const cardDisplayName = translateAsianPokemonName(cardDetail.name);

  const parseOptionalMoney = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(',', '.'));
    if (Number.isNaN(parsed)) {
      throw new Error('Valor financeiro inválido.');
    }
    if (parsed < 0) {
      throw new Error('Os valores financeiros não podem ser negativos.');
    }
    return Math.round(parsed * 100) / 100;
  };

  const handleSubmit = async (
    e: React.FormEvent,
    forceAddToExisting: boolean = false
  ) => {
    e.preventDefault();

    if (!Number.isInteger(quantity) || quantity <= 0) {
      error('A quantidade deve ser um número inteiro positivo.');
      return;
    }

    try {
      const acquisitionCost = parseOptionalMoney(acquisitionCostStr);
      const referenceValue = parseOptionalMoney(referenceValueStr);
      const salePrice = parseOptionalMoney(salePriceStr);

      if (referenceValue !== null && !referenceDateStr.trim()) {
        error('A Data da Consulta de Referência é obrigatória quando o Valor de Referência é informado.');
        return;
      }

      setSubmitting(true);
      const referenceDate = referenceDateStr.trim()
        ? new Date(`${referenceDateStr.trim()}T12:00:00-03:00`).toISOString()
        : null;

      const result = await cardStockService.registerOrAddVariantStock({
        cardDetail,
        condition,
        language,
        finish,
        quantity,
        acquisitionCost,
        referenceValue,
        salePrice,
        referenceDate,
        notes: notes.trim() || null,
        ligaPokemonUrl: customLigaUrl || null,
        allowAddToExisting: forceAddToExisting || Boolean(existingVariant),
      });

      if (result.status === 'DUPLICATE_FOUND') {
        setExistingVariant(result.variant);
        error(
          'Esta variante já está cadastrada! Confirme clicando em "Adicionar quantidade ao estoque existente".'
        );
        return;
      }

      if (result.status === 'ADDED_TO_EXISTING') {
        success(
          `+${quantity} un. adicionada(s) à variante existente! Novo saldo: ${result.variant.quantity} un.`
        );
      } else {
        success(
          `Carta "${cardDisplayName}" adicionada ao estoque com ${result.variant.quantity} un.!`
        );
      }

      setSavedVariantResult({
        variant: result.variant,
        status: result.status,
      });
      onSuccess(result.variant);
    } catch (err: any) {
      error(err.message || 'Erro ao cadastrar variante no estoque');
    } finally {
      setSubmitting(false);
    }
  };

  const ligaUrl = buildLigaPokemonUrl({
    name: cardDetail.name,
    localId: cardDetail.localId,
    totalCards: totalSetCards,
    setId: cardDetail.set?.id,
    setName: cardDetail.set?.name,
    customUrl: customLigaUrl,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        savedVariantResult
          ? 'Estoque Atualizado com Sucesso'
          : existingVariant
            ? 'Adicionar Unidades à Variante Existente'
            : 'Adicionar Carta ao Estoque'
      }
      description="A carta será adicionada diretamente ao Estoque de Cartas mantendo a coleção de origem da carta. Todos os campos financeiros são opcionais."
      maxWidth="2xl"
    >
      {savedVariantResult ? (
        <div className="space-y-6 py-2">
          <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex items-start gap-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <h4 className="text-base font-bold text-white">
                {savedVariantResult.status === 'ADDED_TO_EXISTING'
                  ? 'Quantidade somada à variante existente!'
                  : 'Nova variante registrada no estoque!'}
              </h4>
              <p className="text-xs text-trigon-300">
                A carta <strong>{cardDisplayName}</strong> ({formattedNumber}) —{' '}
                <span className="text-white">
                  {cardDetail.set?.name || 'Coleção não informada'}
                </span>{' '}
                — agora possui{' '}
                <strong className="text-emerald-400">
                  {savedVariantResult.variant.quantity} unidade(s)
                </strong>{' '}
                nesta variante.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <CardConditionBadge value={savedVariantResult.variant.condition} />
                <CardLanguageBadge value={savedVariantResult.variant.language} />
                <CardFinishBadge value={savedVariantResult.variant.finish} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-trigon-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSavedVariantResult(null);
                setQuantity(1);
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              Cadastrar Outra Variante desta Carta
            </Button>

            <div className="flex items-center gap-2.5">
              {onOpenInStock && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenInStock(cardDetail.id)}
                  icon={<ArrowRight className="w-4 h-4 text-emerald-400" />}
                >
                  Abrir no Estoque
                </Button>
              )}
              <Button type="button" variant="primary" onClick={onClose}>
                Concluir
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">
          {/* Resumo da carta (Sem exibir código da coleção entre parênteses nem ID da carta) */}
          <div className="p-4 rounded-2xl bg-trigon-950 border border-trigon-800 flex items-center gap-4">
            <CardThumbnail
              image={cardDetail.image}
              alt={cardDetail.name}
              quality="low"
              size="md"
            />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-white text-base truncate">
                  {cardDisplayName}
                </h4>
                <Badge variant="neutral" size="sm">
                  #{formattedNumber}
                </Badge>
                {cardDetail.rarity && (
                  <Badge variant="warning" size="sm">
                    {cardDetail.rarity}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-trigon-300">
                Coleção:{' '}
                <strong className="text-white">
                  {cardDetail.set?.name || 'Não informado'}
                </strong>
              </p>
            </div>
            <a
              href={ligaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-500/30 transition-all shrink-0"
              title="Consultar referência manualmente na Liga Pokémon"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Liga Pokémon</span>
            </a>
          </div>

          {/* Identificação da Variante: Quantidade, Condição, Idioma e Acabamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
                Condição *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                required
              >
                {conditionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5 flex items-center justify-between">
                <span>Idioma *</span>
                {isLanguageAutoDetected && (
                  <span className="text-[10px] text-emerald-400 font-normal lowercase tracking-normal">
                    (Auto-detectado da coleção)
                  </span>
                )}
              </label>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setIsLanguageAutoDetected(false);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                required
              >
                {languageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1.5">
                Acabamento *
              </label>
              <select
                value={finish}
                onChange={(e) => setFinish(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                required
              >
                {finishOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Alerta de Variante Existente */}
          {existingVariant && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                <PackagePlus className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Variante já cadastrada no estoque!</span>
              </div>
              <p className="text-xs text-trigon-200 leading-relaxed">
                Já existe um registro para esta combinação de carta, condição, idioma e acabamento com{' '}
                <strong className="text-white">{existingVariant.quantity} un.</strong> em estoque
                {existingVariant.salePrice !== null
                  ? ` (Preço de venda atual: ${formatCurrency(existingVariant.salePrice)})`
                  : ''}
                . Ao confirmar, a quantidade informada (<strong>+{quantity} un.</strong>) será
                somada ao saldo existente (
                <strong className="text-emerald-400">
                  {existingVariant.quantity + quantity} un.
                </strong>
                ), preservando o histórico de lotes anteriores.
              </p>
            </div>
          )}

          {/* Campos Financeiros Opcionais */}
          <div className="p-4 rounded-2xl bg-trigon-950/60 border border-trigon-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-trigon-300">
                Informações Financeiras (100% Opcionais)
              </span>
              <span className="text-[11px] text-trigon-500">
                Deixe em branco para manter como Não informado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-400 mb-1">
                  Custo de Aquisição Unitário (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={acquisitionCostStr}
                  onChange={(e) => setAcquisitionCostStr(e.target.value)}
                  placeholder="Opcional — Ex: 15.00"
                  className="w-full px-3.5 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-400 mb-1">
                  Preço de Venda (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salePriceStr}
                  onChange={(e) => setSalePriceStr(e.target.value)}
                  placeholder="Opcional — Ex: 29.90"
                  className="w-full px-3.5 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-400 mb-1">
                  Valor de Referência (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={referenceValueStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setReferenceValueStr(val);
                    if (val.trim() !== '' && !referenceDateStr) {
                      setReferenceDateStr(new Date().toISOString().slice(0, 10));
                    }
                  }}
                  placeholder="Opcional — Ex: 25.00"
                  className="w-full px-3.5 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-400 mb-1 flex items-center justify-between">
                  <span>
                    Data da Consulta {referenceValueStr.trim() !== '' && <span className="text-crimson-400">*</span>}
                  </span>
                  {referenceValueStr.trim() !== '' && !referenceDateStr && (
                    <span className="text-[10px] text-amber-400 lowercase tracking-normal">
                      (Obrigatória ao preencher valor)
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={referenceDateStr}
                  onChange={(e) => setReferenceDateStr(e.target.value)}
                  required={referenceValueStr.trim() !== ''}
                  className={`w-full px-3.5 py-2 rounded-xl bg-trigon-900 border text-white text-sm focus:outline-none transition-colors ${
                    referenceValueStr.trim() !== '' && !referenceDateStr
                      ? 'border-amber-500/80 focus:border-amber-500'
                      : 'border-trigon-750 focus:border-crimson-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-400 mb-1">
                Observações (Opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Lote adquirido de colecionador, carta centralizada, etc."
                className="w-full px-3.5 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-trigon-800">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting || checkingExisting}
              icon={
                existingVariant ? (
                  <PackagePlus className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )
              }
            >
              {existingVariant
                ? `Adicionar +${quantity} un. ao Estoque Existente`
                : 'Confirmar Cadastro no Estoque'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
