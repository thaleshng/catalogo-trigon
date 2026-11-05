import React, { useEffect, useState } from 'react';
import {
  TcgCardVariant,
  TcgCardStockLot,
  TcgCardStockMovement,
  Category,
  Collection,
} from '../../../types';
import { cardStockService } from '../../../services/cardStockService';
import { formatCardNumber } from '../../../services/tcgdexService';
import {
  buildLigaPokemonUrl,
  getCardConditionOptions,
  getCardLanguageOptions,
  getCardFinishOptions,
} from '../../../config/tcgCardOptions';
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/formatters';
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
  ExternalLink,
  Save,
  History,
  Layers,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Boxes,
} from 'lucide-react';

interface CardVariantEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: TcgCardVariant | null;
  categories?: Category[];
  collections?: Collection[];
  onSaved: (updated?: TcgCardVariant) => void;
  onDeleted?: (variantId: string) => void;
}

export const CardVariantEditModal: React.FC<CardVariantEditModalProps> = ({
  isOpen,
  onClose,
  variant,
  categories = [],
  collections = [],
  onSaved,
  onDeleted,
}) => {
  const conditionOptions = getCardConditionOptions();
  const languageOptions = getCardLanguageOptions();
  const finishOptions = getCardFinishOptions();

  const [cardName, setCardName] = useState<string>('');
  const [condition, setCondition] = useState<string>('NM');
  const [language, setLanguage] = useState<string>('PT');
  const [finish, setFinish] = useState<string>('NORMAL');

  const [acquisitionCostStr, setAcquisitionCostStr] = useState<string>('');
  const [referenceValueStr, setReferenceValueStr] = useState<string>('');
  const [salePriceStr, setSalePriceStr] = useState<string>('');
  const [referenceDateStr, setReferenceDateStr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Vínculo opcional no estoque para comercialização no site (Linha de Produtos ou Coleção)
  const [selectedSiteLink, setSelectedSiteLink] = useState<string>('NONE');

  const [lots, setLots] = useState<TcgCardStockLot[]>([]);
  const [movements, setMovements] = useState<TcgCardStockMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  const { success, error } = useToast();

  useEffect(() => {
    if (!isOpen || !variant) return;

    setCardName(variant.card?.name || '');
    setCondition(variant.condition || 'NM');
    setLanguage(variant.language || 'PT');
    setFinish(variant.finish || 'NORMAL');

    setAcquisitionCostStr(
      variant.acquisitionCost !== null && variant.acquisitionCost !== undefined
        ? String(variant.acquisitionCost)
        : ''
    );
    setReferenceValueStr(
      variant.referenceValue !== null && variant.referenceValue !== undefined
        ? String(variant.referenceValue)
        : ''
    );
    setSalePriceStr(
      variant.salePrice !== null && variant.salePrice !== undefined
        ? String(variant.salePrice)
        : ''
    );
    setReferenceDateStr(
      variant.referenceDate ? variant.referenceDate.slice(0, 10) : ''
    );
    setNotes(variant.notes || '');

    if (variant.categoryId) {
      setSelectedSiteLink(`cat:${variant.categoryId}`);
    } else if (variant.collectionId) {
      setSelectedSiteLink(`col:${variant.collectionId}`);
    } else {
      setSelectedSiteLink('NONE');
    }

    setLoadingHistory(true);
    Promise.all([
      cardStockService.getLotsByVariant(variant.id),
      cardStockService.getMovements({ variantId: variant.id, limit: 25 }),
    ])
      .then(([loadedLots, loadedMovs]) => {
        setLots(loadedLots);
        setMovements(loadedMovs);
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }, [isOpen, variant]);

  if (!isOpen || !variant) return null;

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const acquisitionCost = parseOptionalMoney(acquisitionCostStr);
      const referenceValue = parseOptionalMoney(referenceValueStr);
      const salePrice = parseOptionalMoney(salePriceStr);

      if (referenceValue !== null && !referenceDateStr.trim()) {
        error('A Data da Consulta de Referência é obrigatória quando o Valor de Referência é informado.');
        return;
      }

      setSaving(true);
      const referenceDate = referenceDateStr.trim()
        ? new Date(`${referenceDateStr.trim()}T12:00:00-03:00`).toISOString()
        : null;

      let categoryId: string | null = null;
      let collectionId: string | null = null;

      if (selectedSiteLink.startsWith('cat:')) {
        categoryId = selectedSiteLink.replace('cat:', '');
      } else if (selectedSiteLink.startsWith('col:')) {
        collectionId = selectedSiteLink.replace('col:', '');
      }

      if (cardName.trim() && variant.card && cardName.trim() !== variant.card.name) {
        await cardStockService.updateCardName(variant.card.id, cardName.trim());
      }

      const updated = await cardStockService.updateVariantDetails(variant.id, {
        condition,
        language,
        finish,
        acquisitionCost,
        referenceValue,
        salePrice,
        referenceDate,
        notes: notes.trim() || null,
        categoryId,
        collectionId,
      });

      if (variant.card && cardName.trim()) {
        updated.card = {
          ...variant.card,
          name: cardName.trim(),
        };
      }

      success('Informações da variante atualizadas com sucesso!');
      onSaved(updated);
      onClose();
    } catch (err: any) {
      error(err.message || 'Erro ao salvar informações da variante');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariant = async () => {
    const cardName = variant.card?.name || 'Carta';
    const formattedNumber = formatCardNumber(variant.card?.localId, variant.card?.totalCards);
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir esta variante da carta "${cardName}" (${formattedNumber}) do estoque?\n\n` +
      `• Acabamento: ${variant.finish}\n` +
      `• Idioma: ${variant.language}\n` +
      `• Condição: ${variant.condition}\n` +
      `• Saldo: ${variant.quantity} un.\n\n` +
      `Esta ação removerá permanentemente a variante, seus lotes de aquisição e movimentações de estoque. Deseja continuar?`
    );
    if (!confirmDelete) return;

    try {
      setDeleting(true);
      await cardStockService.deleteVariant(variant.id);
      success('Variante excluída com sucesso do estoque!');
      if (onDeleted) {
        onDeleted(variant.id);
      } else {
        onSaved();
      }
      onClose();
    } catch (err: any) {
      error(err.message || 'Erro ao excluir variante');
    } finally {
      setDeleting(false);
    }
  };

  const handleClearFinancials = () => {
    setAcquisitionCostStr('');
    setReferenceValueStr('');
    setSalePriceStr('');
    setReferenceDateStr('');
  };

  const numericCost =
    acquisitionCostStr.trim() !== ''
      ? Number(acquisitionCostStr.replace(',', '.'))
      : null;
  const numericSale =
    salePriceStr.trim() !== '' ? Number(salePriceStr.replace(',', '.')) : null;
  const canCalculateMargin =
    numericCost !== null &&
    !Number.isNaN(numericCost) &&
    numericSale !== null &&
    !Number.isNaN(numericSale) &&
    numericSale > 0;

  const profitValue = canCalculateMargin ? numericSale - numericCost : null;
  const marginPercent =
    canCalculateMargin && numericSale > 0
      ? ((numericSale - numericCost) / numericSale) * 100
      : null;

  const ligaUrl = buildLigaPokemonUrl({
    name: variant.card?.name || '',
    localId: variant.card?.localId,
    totalCards: variant.card?.totalCards,
    setId: variant.card?.setCode,
    setName: variant.card?.setName,
    customUrl: variant.card?.ligaPokemonUrl,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Variante, Preços & Vínculo com o Catálogo"
      description="Edite acabamento (Foil), idioma, condição, valores financeiros e vínculo com o Catálogo."
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Cabeçalho da Variante */}
        <div className="p-4 rounded-2xl bg-trigon-950 border border-trigon-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <CardThumbnail
              image={variant.card?.imageUrl}
              alt={variant.card?.name || 'Carta'}
              quality="low"
              size="sm"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-white text-base">
                  {variant.card?.name || 'Carta TCG'}{' '}
                  <span className="font-mono text-xs text-trigon-400 font-normal">
                    (
                    {formatCardNumber(
                      variant.card?.localId,
                      variant.card?.totalCards
                    )}
                    )
                  </span>
                </h4>
              </div>
              <p className="text-xs text-trigon-300">
                Coleção da Carta:{' '}
                <strong className="text-white">
                  {variant.card?.setName || 'Não informado'}
                </strong>
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <CardConditionBadge value={variant.condition} size="sm" />
                <CardLanguageBadge value={variant.language} size="sm" />
                <CardFinishBadge value={variant.finish} size="sm" />
                <Badge variant="neutral" size="sm">
                  Saldo: {variant.quantity} un.
                </Badge>
              </div>
            </div>
          </div>

          <a
            href={ligaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border border-amber-500/40 transition-all self-start sm:self-center"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            <span>Consultar na Liga Pokémon</span>
          </a>
        </div>

        {/* Formulário de Edição */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* 1. Atributos da Carta (Nome, Foil, Idioma e Condição) */}
          <div className="p-4 rounded-2xl bg-trigon-950/60 border border-trigon-800 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-trigon-300">
              Identificação & Atributos da Carta
            </h5>
            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-400 mb-1">
                Nome da Carta (Exibição no Catálogo/Estoque) *
              </label>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Nome da carta..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm font-bold focus:outline-none focus:border-crimson-500"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-400 mb-1">
                  Acabamento / Foil *
                </label>
                <select
                  value={finish}
                  onChange={(e) => setFinish(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                  required
                >
                  {finishOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-400 mb-1">
                  Idioma *
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
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
                <label className="block text-xs font-semibold uppercase text-trigon-400 mb-1">
                  Condição *
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                  required
                >
                  {conditionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Vínculo Opcional com o Catálogo TRIGON */}
          <div className="p-4 rounded-2xl bg-trigon-950/60 border border-trigon-800 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-trigon-300 flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-amber-400" />
              <span>Vínculo com o Catálogo TRIGON (Opcional)</span>
            </label>
            <p className="text-[11px] text-trigon-400">
              Por padrão a carta fica apenas no controle interno de estoque com sua coleção original (
              <strong className="text-trigon-200">{variant.card?.setName}</strong>). Se desejar
              associá-la ao Catálogo da TRIGON, selecione abaixo:
            </p>
            <select
              value={selectedSiteLink}
              onChange={(e) => setSelectedSiteLink(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
            >
              <option value="NONE">
                Apenas Controle Interno (Sem vínculo com o catálogo)
              </option>
              {categories.length > 0 && (
                <optgroup label="Linhas de Produtos (Catálogo TRIGON)">
                  {categories.map((cat) => (
                    <option key={cat.id} value={`cat:${cat.id}`}>
                      Linha de Produtos: {cat.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {collections.length > 0 && (
                <optgroup label="Coleções (Catálogo TRIGON)">
                  {collections.map((col) => (
                    <option key={col.id} value={`col:${col.id}`}>
                      Coleção do Catálogo: {col.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* 3. Valores Financeiros Opcionais */}
          <div className="p-4 rounded-2xl bg-trigon-950/60 border border-trigon-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-trigon-300">
                Valores Financeiros (Opcionais)
              </h5>
              <button
                type="button"
                onClick={handleClearFinancials}
                className="inline-flex items-center gap-1 text-xs text-crimson-400 hover:text-crimson-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar todos os valores</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-400 mb-1">
                  Custo de Aquisição (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={acquisitionCostStr}
                  onChange={(e) => setAcquisitionCostStr(e.target.value)}
                  placeholder="Não informado"
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
                  placeholder="Não informado"
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
                  placeholder="Não informado"
                  className="w-full px-3.5 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
                <span className="text-[10px] text-trigon-500 mt-0.5 block">
                  Apoio interno. Não altera automaticamente o preço de venda.
                </span>
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

            {canCalculateMargin && profitValue !== null && marginPercent !== null && (
              <div className="p-3 rounded-xl bg-trigon-900 border border-trigon-800 flex items-center justify-between text-xs">
                <span className="text-trigon-400">
                  Resultado estimado por unidade (Venda − Custo):
                </span>
                <span
                  className={`font-mono font-bold ${
                    profitValue >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatCurrency(profitValue)} ({marginPercent.toFixed(1)}%)
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase text-trigon-400 mb-1">
                Observações da Variante
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sem observações..."
                className="w-full px-3.5 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-xs focus:outline-none focus:border-crimson-500"
              />
            </div>
          </div>

          {/* Rodapé com Ações de Excluir e Salvar */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleDeleteVariant}
              disabled={deleting || saving}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Excluir permanentemente esta variante do estoque"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deleting ? 'Excluindo...' : 'Excluir do Estoque'}</span>
            </button>

            <div className="flex items-center justify-end gap-2.5">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving || deleting}>
                Fechar
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                disabled={deleting}
                icon={<Save className="w-4 h-4" />}
              >
                Salvar Alterações
              </Button>
            </div>
          </div>
        </form>

        {/* Lotes de Aquisição & Histórico da Variante */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-trigon-800">
          <div className="space-y-2.5">
            <h5 className="text-xs font-bold uppercase tracking-wider text-trigon-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-crimson-400" />
              <span>Lotes de Entrada ({lots.length})</span>
            </h5>
            <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
              {loadingHistory ? (
                <p className="text-xs text-trigon-500">Carregando lotes...</p>
              ) : lots.length === 0 ? (
                <p className="text-xs text-trigon-500">Nenhum lote registrado.</p>
              ) : (
                lots.map((lot) => (
                  <div
                    key={lot.id}
                    className="p-2.5 rounded-xl bg-trigon-950 border border-trigon-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400">+{lot.quantity} un.</span>
                      <span className="text-trigon-400 text-[11px]">
                        {formatDate(lot.entryDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-trigon-400">Custo Unitário:</span>
                      <span className="font-mono text-white">
                        {lot.unitCost !== null ? formatCurrency(lot.unitCost) : 'Não informado'}
                      </span>
                    </div>
                    {lot.notes && (
                      <p className="text-[11px] text-trigon-400 truncate" title={lot.notes}>
                        {lot.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            <h5 className="text-xs font-bold uppercase tracking-wider text-trigon-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-crimson-400" />
              <span>Histórico desta Variante ({movements.length})</span>
            </h5>
            <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
              {loadingHistory ? (
                <p className="text-xs text-trigon-500">Carregando movimentações...</p>
              ) : movements.length === 0 ? (
                <p className="text-xs text-trigon-500">Nenhuma movimentação.</p>
              ) : (
                movements.map((mov) => {
                  const isEntry = mov.newStock >= mov.previousStock;
                  return (
                    <div
                      key={mov.id}
                      className="p-2.5 rounded-xl bg-trigon-950 border border-trigon-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            isEntry ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isEntry ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          )}
                          {mov.type} ({isEntry ? `+${mov.quantity}` : `-${mov.quantity}`} un.)
                        </span>
                        <span className="font-mono text-[11px] text-trigon-300">
                          {mov.previousStock} ➔ {mov.newStock} un.
                        </span>
                      </div>
                      <p className="text-[11px] text-trigon-300 truncate" title={mov.reason}>
                        {mov.reason}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-trigon-500">
                        <span>{formatDateTime(mov.createdAt)}</span>
                        {mov.actor && <span>por {mov.actor}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
