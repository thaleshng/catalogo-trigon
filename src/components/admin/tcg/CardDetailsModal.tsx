import React, { useEffect, useState } from 'react';
import {
  TcgdexCardDetail,
  TcgCard,
  TcgCardVariant,
} from '../../../types';
import {
  tcgdexService,
  formatTcgdexImageUrl,
  formatCardNumber,
} from '../../../services/tcgdexService';
import { cardStockService } from '../../../services/cardStockService';
import { buildLigaPokemonUrl } from '../../../config/tcgCardOptions';
import { translateAsianPokemonName } from '../../../config/tcgSetTranslations';
import { formatCurrency } from '../../../utils/formatters';
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
  ExternalLink,
  ZoomIn,
  X,
  PackageCheck,
  Link2,
  Check,
} from 'lucide-react';

interface CardDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string | null;
  initialDetail?: TcgdexCardDetail | null;
  registeredStock?: {
    card: TcgCard;
    variants: TcgCardVariant[];
    totalQuantity: number;
  } | null;
  onAddToStock: (detail: TcgdexCardDetail, customLigaUrl?: string | null) => void;
  onViewInStock?: (tcgdexId: string) => void;
  onStockUpdated?: () => void;
}

export const CardDetailsModal: React.FC<CardDetailsModalProps> = ({
  isOpen,
  onClose,
  cardId,
  initialDetail,
  registeredStock,
  onAddToStock,
  onViewInStock,
  onStockUpdated,
}) => {
  const [detail, setDetail] = useState<TcgdexCardDetail | null>(initialDetail || null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);

  // URL exata opcional da Liga Pokémon
  const [isEditingLigaUrl, setIsEditingLigaUrl] = useState(false);
  const [customLigaUrl, setCustomLigaUrl] = useState<string>('');
  const [savingLigaUrl, setSavingLigaUrl] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    if (!isOpen || !cardId) {
      setDetail(null);
      setErrorMsg(null);
      setIsImageZoomOpen(false);
      setIsEditingLigaUrl(false);
      return;
    }

    setCustomLigaUrl(registeredStock?.card?.ligaPokemonUrl || '');

    // Se for uma carta manual ou se já temos a carta no estoque registrado:
    if (registeredStock?.card && (cardId.startsWith('manual-') || registeredStock.card.tcgdexId === cardId)) {
      const c = registeredStock.card;
      setDetail({
        id: c.tcgdexId,
        localId: c.localId,
        name: c.name,
        image: c.imageUrl,
        rarity: c.rarity,
        category: c.category || 'Pokemon',
        set: {
          id: c.setCode || 'MANUAL',
          name: c.setName,
          cardCount: c.totalCards
            ? { official: c.totalCards, total: c.totalCards }
            : undefined,
        },
      });
      setLoading(false);
      return;
    }

    if (initialDetail && initialDetail.id === cardId) {
      setDetail(initialDetail);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setErrorMsg(null);

    tcgdexService
      .getCardById(cardId, controller.signal)
      .then((res) => {
        setDetail(res);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setErrorMsg(err?.message || 'Não foi possível carregar os detalhes da carta.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [isOpen, cardId, initialDetail, registeredStock]);

  if (!isOpen) return null;

  const totalSetCards =
    detail?.set?.cardCount?.official ?? detail?.set?.cardCount?.total ?? null;
  const formattedNumber = detail
    ? formatCardNumber(detail.localId, totalSetCards)
    : '—';
  const cardDisplayName = detail ? translateAsianPokemonName(detail.name) : '';

  const highResImageUrl = formatTcgdexImageUrl(detail?.image, 'high');

  const ligaUrl = detail
    ? buildLigaPokemonUrl({
        name: detail.name,
        localId: detail.localId,
        totalCards: totalSetCards,
        setId: detail.set?.id,
        setName: detail.set?.name,
        customUrl: customLigaUrl || registeredStock?.card?.ligaPokemonUrl,
      })
    : '#';

  const handleSaveCustomLigaUrl = async () => {
    if (registeredStock?.card) {
      try {
        setSavingLigaUrl(true);
        await cardStockService.updateCardLigaPokemonUrl(
          registeredStock.card.id,
          customLigaUrl.trim() || null
        );
        success('Link da Liga Pokémon atualizado para esta carta.');
        setIsEditingLigaUrl(false);
        onStockUpdated?.();
      } catch (err: any) {
        error(err.message || 'Erro ao salvar URL da Liga Pokémon');
      } finally {
        setSavingLigaUrl(false);
      }
    } else {
      setIsEditingLigaUrl(false);
      success('Link personalizado aplicado para esta sessão e cadastro.');
    }
  };

  const hasExistingVariants = Boolean(
    registeredStock && registeredStock.variants.length > 0
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={detail ? `${cardDisplayName} (${formattedNumber})` : 'Detalhes da Carta TCG'}
        description={
          detail
            ? detail.set?.name || 'Coleção não informada'
            : 'Consultando informações da carta...'
        }
        maxWidth="3xl"
      >
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-trigon-400">
            <div className="w-8 h-8 border-2 border-crimson-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Carregando informações da carta...</p>
          </div>
        ) : errorMsg || !detail ? (
          <div className="py-12 text-center space-y-4">
            <p className="text-sm text-crimson-400">
              {errorMsg || 'Carta não encontrada.'}
            </p>
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Lado Esquerdo: Imagem proporcional e opção de ampliar */}
              <div className="md:col-span-5 flex flex-col items-center space-y-3">
                <div className="relative group w-full max-w-[250px] mx-auto">
                  <CardThumbnail
                    image={detail.image}
                    alt={detail.name}
                    quality="high"
                    size="full"
                    onClick={() => highResImageUrl && setIsImageZoomOpen(true)}
                  />
                  {highResImageUrl && (
                    <button
                      type="button"
                      onClick={() => setIsImageZoomOpen(true)}
                      className="mt-2.5 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-trigon-950/90 hover:bg-trigon-850 border border-trigon-750 text-xs font-medium text-trigon-200 hover:text-white transition-all"
                    >
                      <ZoomIn className="w-4 h-4 text-crimson-400" />
                      <span>Visualizar em Tamanho Maior</span>
                    </button>
                  )}
                  {detail.id && detail.id.startsWith('manual-') && (
                    <div className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-500/40 text-[11px] font-semibold text-amber-300 text-center">
                      <span>✍️ Carta Cadastrada Manualmente (Trigon)</span>
                    </div>
                  )}
                  {detail.image && !detail.id.startsWith('manual-') && detail.image.includes('digitaloceanspaces.com/tpc/') && (
                    <div className="mt-2 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-[11px] font-medium text-emerald-300 text-center">
                      <span>🇯🇵 Scan oficial original em Japonês</span>
                    </div>
                  )}
                  {detail.image && !detail.id.startsWith('manual-') && detail.image.includes('digitaloceanspaces.com/tpci/') && (
                    <div className="mt-2 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/70 border border-blue-500/40 text-[11px] font-medium text-blue-300 text-center">
                      <span>🇧🇷 Scan oficial em Português</span>
                    </div>
                  )}
                  {detail.image && !detail.id.startsWith('manual-') && detail.image.includes('/en/') && (
                    <p className="mt-2 text-[10px] text-trigon-400 text-center italic leading-tight">
                      *Scan oficial ocidental (mesma arte ilustrada por {detail.illustrator || 'artista oficial'})
                    </p>
                  )}
                </div>
              </div>

              {/* Lado Direito: Informações objetivas para controle e vendas */}
              <div className="md:col-span-7 space-y-4">
                {/* Atributos Comerciais Principais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-trigon-950 border border-trigon-800">
                    <span className="text-[10px] uppercase tracking-wider text-trigon-400 block">
                      Nome da Carta
                    </span>
                    <span className="text-sm font-bold text-white mt-0.5 block">
                      {cardDisplayName || 'Não informado'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-trigon-950 border border-trigon-800">
                    <span className="text-[10px] uppercase tracking-wider text-trigon-400 block">
                      Coleção / Edição
                    </span>
                    <span
                      className="text-sm font-semibold text-white mt-0.5 block truncate"
                      title={detail.set?.name}
                    >
                      {detail.set?.name || 'Não informado'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-trigon-950 border border-trigon-800">
                    <span className="text-[10px] uppercase tracking-wider text-trigon-400 block">
                      Número na Coleção
                    </span>
                    <span className="text-sm font-mono font-bold text-white mt-0.5 block">
                      {formattedNumber}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-trigon-950 border border-trigon-800">
                    <span className="text-[10px] uppercase tracking-wider text-trigon-400 block">
                      Raridade
                    </span>
                    <span className="text-sm font-semibold text-amber-300 mt-0.5 block">
                      {detail.rarity || 'Não informado'}
                    </span>
                  </div>
                </div>

                {/* Versões físicas informadas pela TCGdex */}
                {detail.variants && (
                  <div className="p-3.5 rounded-xl bg-trigon-950/70 border border-trigon-800 space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-trigon-400 block">
                      Acabamentos catalogados para esta carta
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.variants.normal && (
                        <Badge variant="neutral" size="sm">
                          Normal
                        </Badge>
                      )}
                      {detail.variants.holo && (
                        <Badge variant="warning" size="sm">
                          Foil / Holo
                        </Badge>
                      )}
                      {detail.variants.reverse && (
                        <Badge variant="info" size="sm">
                          Reverse Foil
                        </Badge>
                      )}
                      {detail.variants.firstEdition && (
                        <Badge variant="crimson" size="sm">
                          1ª Edição
                        </Badge>
                      )}
                      {detail.variants.wPromo && (
                        <Badge variant="success" size="sm">
                          W Promo
                        </Badge>
                      )}
                      {!detail.variants.normal &&
                        !detail.variants.holo &&
                        !detail.variants.reverse &&
                        !detail.variants.firstEdition &&
                        !detail.variants.wPromo && (
                          <span className="text-xs text-trigon-500">Padrão</span>
                        )}
                    </div>
                  </div>
                )}

                {/* Status da Carta no Estoque TRIGON */}
                {hasExistingVariants && registeredStock && (
                  <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <PackageCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                          No Estoque ({registeredStock.totalQuantity} un. em{' '}
                          {registeredStock.variants.length} variante(s))
                        </span>
                      </div>
                      {onViewInStock && (
                        <button
                          type="button"
                          onClick={() => onViewInStock(detail.id)}
                          className="text-xs font-semibold text-emerald-300 hover:text-white underline"
                        >
                          Ver no Estoque →
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {registeredStock.variants.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-trigon-950/90 border border-trigon-800 text-xs"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <CardConditionBadge value={v.condition} size="sm" />
                            <CardLanguageBadge value={v.language} size="sm" />
                            <CardFinishBadge value={v.finish} size="sm" />
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {v.salePrice !== null && v.salePrice !== undefined && (
                              <span className="font-mono text-emerald-400 font-semibold">
                                {formatCurrency(v.salePrice)}
                              </span>
                            )}
                            <span className="font-mono font-bold text-white">
                              {v.quantity} un.
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Configuração opcional de URL validada da Liga Pokémon */}
                <div className="p-3 rounded-xl bg-trigon-950/60 border border-trigon-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-trigon-400 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        Consulta manual na Liga Pokémon{' '}
                        {customLigaUrl
                          ? '(URL exata configurada)'
                          : '(Busca por nome e número)'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingLigaUrl((prev) => !prev)}
                      className="text-[11px] text-crimson-400 hover:text-crimson-300 font-medium"
                    >
                      {isEditingLigaUrl ? 'Cancelar' : 'Configurar URL exata'}
                    </button>
                  </div>

                  {isEditingLigaUrl && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="url"
                        value={customLigaUrl}
                        onChange={(e) => setCustomLigaUrl(e.target.value)}
                        placeholder="https://www.ligapokemon.com.br/?view=cards/card&card=..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-trigon-900 border border-trigon-700 text-xs text-white focus:outline-none focus:border-crimson-500"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={savingLigaUrl}
                        onClick={handleSaveCustomLigaUrl}
                        icon={<Check className="w-3.5 h-3.5" />}
                      >
                        Salvar URL
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rodapé de Ações do Modal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-trigon-800">
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={ligaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border border-amber-500/40 transition-all"
                >
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                  <span>Consultar na Liga Pokémon</span>
                </a>

                {hasExistingVariants && onViewInStock && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onViewInStock(detail.id)}
                    icon={<PackageCheck className="w-4 h-4 text-emerald-400" />}
                  >
                    Ver no Estoque
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Fechar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => onAddToStock(detail, customLigaUrl || null)}
                  icon={<Plus className="w-4 h-4" />}
                >
                  {hasExistingVariants ? 'Adicionar mais unidades' : 'Adicionar ao Estoque'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Lightbox de Imagem Ampliada */}
      {isImageZoomOpen && highResImageUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsImageZoomOpen(false)}
        >
          <div
            className="relative max-w-md w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsImageZoomOpen(false)}
              className="self-end p-2 rounded-xl bg-trigon-900 border border-trigon-700 text-trigon-300 hover:text-white"
              aria-label="Fechar visualização ampliada"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={highResImageUrl}
              alt={detail?.name || 'Carta Pokémon'}
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-trigon-700"
            />
          </div>
        </div>
      )}
    </>
  );
};
