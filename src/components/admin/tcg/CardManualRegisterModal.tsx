import React, { useState, useRef, useMemo } from 'react';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { useToast } from '../../common/Toast';
import {
  getCardConditionOptions,
  getCardLanguageOptions,
  getCardFinishOptions,
} from '../../../config/tcgCardOptions';
import {
  cardStockService,
  RegisterManualCardInput,
} from '../../../services/cardStockService';
import { storageUploadService } from '../../../services/storageUploadService';
import { optimizeImage, optimizeImageFile } from '../../../utils/imageUpload';
import { TcgCardVariant } from '../../../types';
import {
  Upload,
  Camera,
  Trash2,
  CheckCircle2,
  Link2,
  Plus,
  Sparkles,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';

interface CardManualRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (variant: TcgCardVariant) => void;
}

export const CardManualRegisterModal: React.FC<CardManualRegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { success, error } = useToast();

  const conditionOptions = getCardConditionOptions();
  const languageOptions = getCardLanguageOptions();
  const finishOptions = getCardFinishOptions();

  // Dados da Carta
  const [name, setName] = useState('');
  const [setNameText, setSetNameText] = useState('');
  const [setCode, setSetCode] = useState('');
  const [localId, setLocalId] = useState('');
  const [rarity, setRarity] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ligaPokemonUrl, setLigaPokemonUrl] = useState('');

  // Dados da Variante Inicial de Estoque
  const [condition, setCondition] = useState(
    conditionOptions[1]?.value || conditionOptions[0]?.value || 'NM'
  );
  const [language, setLanguage] = useState('ZH-CN');
  const [finish, setFinish] = useState('NORMAL');
  const [quantity, setQuantity] = useState<number>(1);

  // Atributos Financeiros Opcionais
  const [acquisitionCostStr, setAcquisitionCostStr] = useState('');
  const [referenceValueStr, setReferenceValueStr] = useState('');
  const [salePriceStr, setSalePriceStr] = useState('');
  const [notes, setNotes] = useState('');

  // Upload de Foto
  const fileInputPcRef = useRef<HTMLInputElement | null>(null);
  const cameraMobileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Detecta se é dispositivo móvel para dar destaque ao botão de câmera
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const mobileRegex = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const hasTouch = navigator.maxTouchPoints > 0;
    return mobileRegex.test(userAgent) || (window.innerWidth <= 768 && hasTouch);
  }, []);

  const handlePhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    try {
      setUploadingPhoto(true);
      const compressedFile = await optimizeImageFile(rawFile, 1200, 0.82);

      try {
        const publicUrl = await storageUploadService.uploadImage(compressedFile, 'products');
        setImageUrl(publicUrl);
        success('Foto otimizada e salva com sucesso!');
      } catch {
        const base64 = await optimizeImage(rawFile, 1200);
        setImageUrl(base64);
        success('Foto anexada localmente!');
      }
    } catch (err: any) {
      error(err.message || 'Erro ao processar imagem.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const parseOptionalMoney = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(',', '.'));
    if (Number.isNaN(parsed)) {
      throw new Error('Valor financeiro inválido.');
    }
    return parsed >= 0 ? parsed : null;
  };

  const handleResetForm = () => {
    setName('');
    setSetNameText('');
    setSetCode('');
    setLocalId('');
    setRarity('');
    setImageUrl('');
    setLigaPokemonUrl('');
    setCondition('NM');
    setLanguage('ZH-CN');
    setFinish('NORMAL');
    setQuantity(1);
    setAcquisitionCostStr('');
    setReferenceValueStr('');
    setSalePriceStr('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      error('Informe o nome da carta.');
      return;
    }
    if (!setNameText.trim()) {
      error('Informe o nome da coleção / expansão.');
      return;
    }
    if (!localId.trim()) {
      error('Informe o número da carta na coleção (ex: 045/208).');
      return;
    }
    if (quantity <= 0) {
      error('A quantidade deve ser de no mínimo 1 unidade.');
      return;
    }

    try {
      setSubmitting(true);

      const acquisitionCost = parseOptionalMoney(acquisitionCostStr);
      const referenceValue = parseOptionalMoney(referenceValueStr);
      const salePrice = parseOptionalMoney(salePriceStr);

      const payload: RegisterManualCardInput = {
        name: name.trim(),
        setName: setNameText.trim(),
        setCode: setCode.trim() || null,
        localId: localId.trim(),
        rarity: rarity.trim() || null,
        imageUrl: imageUrl.trim() || null,
        ligaPokemonUrl: ligaPokemonUrl.trim() || null,
        condition,
        language,
        finish,
        quantity,
        acquisitionCost,
        referenceValue,
        salePrice,
        notes: notes.trim() || null,
      };

      const result = await cardStockService.registerManualCardAndVariant(payload);

      success(
        result.status === 'ADDED_TO_EXISTING'
          ? `Quantidade somada à variante existente de "${name.trim()}"!`
          : `Carta manual "${name.trim()}" cadastrada com sucesso no estoque!`
      );

      handleResetForm();
      onSuccess(result.variant);
      onClose();
    } catch (err: any) {
      error(err.message || 'Erro ao cadastrar carta manual no estoque.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cadastrar Carta Manualmente no Estoque"
      description="Use para registrar cartas especiais que não constam no catálogo internacional da TCGdex (ex: coleções chinesas recentes, Trick or Trade, promos exclusivas)."
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seção 1: Identificação da Carta */}
        <div className="p-4 sm:p-5 rounded-2xl bg-trigon-950 border border-trigon-800 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-trigon-800/80">
            <Sparkles className="w-4 h-4 text-crimson-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              1. Identificação da Carta
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            {/* Nome da Carta */}
            <div className="sm:col-span-7">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Nome da Carta *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Garchomp ex, Litwick, Drowzee..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white placeholder-trigon-500 text-sm font-bold focus:outline-none focus:border-crimson-500"
                required
              />
            </div>

            {/* Número na Coleção */}
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Número na Coleção *
              </label>
              <input
                type="text"
                value={localId}
                onChange={(e) => setLocalId(e.target.value)}
                placeholder="Ex: 045/208, 096C/151, 1502-07/196..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white placeholder-trigon-500 text-sm font-mono focus:outline-none focus:border-crimson-500"
                required
              />
            </div>

            {/* Coleção / Expansão */}
            <div className="sm:col-span-8">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Coleção / Expansão *
              </label>
              <input
                type="text"
                value={setNameText}
                onChange={(e) => setSetNameText(e.target.value)}
                placeholder="Ex: Terastal Gathering, Trick or Trade 2023, Gem Pack Vol. 5..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white placeholder-trigon-500 text-sm focus:outline-none focus:border-crimson-500"
                required
              />
            </div>

            {/* Código / Sigla do Set */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Código do Set <span className="text-trigon-500 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={setCode}
                onChange={(e) => setSetCode(e.target.value.toUpperCase())}
                placeholder="Ex: C9.5C, TOT23, 151C..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white placeholder-trigon-500 text-sm font-mono focus:outline-none focus:border-crimson-500"
              />
            </div>

            {/* Raridade */}
            <div className="sm:col-span-6">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Raridade <span className="text-trigon-500 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={rarity}
                onChange={(e) => setRarity(e.target.value)}
                placeholder="Ex: Rara Dupla, Comum, AR, SAR, Promo..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white placeholder-trigon-500 text-sm focus:outline-none focus:border-crimson-500"
              />
            </div>

            {/* Link da Liga Pokémon */}
            <div className="sm:col-span-6">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                URL na Liga Pokémon <span className="text-trigon-500 font-normal">(Opcional)</span>
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-trigon-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={ligaPokemonUrl}
                  onChange={(e) => setLigaPokemonUrl(e.target.value)}
                  placeholder="https://www.ligapokemon.com.br/?view=cards/card..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white placeholder-trigon-500 text-xs focus:outline-none focus:border-crimson-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Upload / Foto da Carta */}
          <div className="pt-2 border-t border-trigon-800/80 space-y-2.5">
            <label className="block text-xs font-semibold uppercase text-trigon-300">
              Foto da Carta <span className="text-trigon-500 font-normal">(Upload, Câmera ou Link)</span>
            </label>

            {/* Inputs ocultos */}
            <input
              ref={fileInputPcRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoPicked}
            />
            <input
              ref={cameraMobileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoPicked}
            />

            {imageUrl ? (
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-trigon-900 border border-emerald-500/40">
                <div className="w-14 h-20 rounded-lg overflow-hidden bg-black flex items-center justify-center border border-trigon-750 shrink-0 shadow-md">
                  <img
                    src={imageUrl}
                    alt="Prévia Foto"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Foto Anexada</span>
                  </div>
                  <p className="text-[11px] text-trigon-400 font-mono truncate mt-0.5">
                    {imageUrl.startsWith('data:') ? 'Imagem salva localmente' : imageUrl}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => fileInputPcRef.current?.click()}
                      className="text-xs text-trigon-300 hover:text-white underline font-medium"
                    >
                      Trocar foto
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="w-3 h-3" /> Remover
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputPcRef.current?.click()}
                    loading={uploadingPhoto}
                    icon={<Upload className="w-3.5 h-3.5 text-crimson-400" />}
                  >
                    Upload do PC
                  </Button>

                  <Button
                    type="button"
                    variant={isMobile ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => cameraMobileRef.current?.click()}
                    loading={uploadingPhoto}
                    icon={<Camera className="w-3.5 h-3.5 text-amber-400" />}
                  >
                    Foto da Câmera
                  </Button>
                </div>

                <div className="relative">
                  <ImageIcon className="w-4 h-4 text-trigon-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Ou cole o link direto da imagem (ex: https://...)"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white placeholder-trigon-500 text-xs focus:outline-none focus:border-crimson-500 font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Seção 2: Variante Inicial do Estoque */}
        <div className="p-4 sm:p-5 rounded-2xl bg-trigon-950 border border-trigon-800 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-trigon-800/80">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              2. Variante Inicial do Estoque
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            {/* Condição */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Condição *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              >
                {conditionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Idioma */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Idioma *
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              >
                {languageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Acabamento */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Acabamento *
              </label>
              <select
                value={finish}
                onChange={(e) => setFinish(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
              >
                {finishOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantidade */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Quantidade *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm font-bold focus:outline-none focus:border-crimson-500"
                required
              />
            </div>

            {/* Custo de Aquisição */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Custo Unitário (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={acquisitionCostStr}
                onChange={(e) => setAcquisitionCostStr(e.target.value)}
                placeholder="0,00"
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm font-mono focus:outline-none focus:border-crimson-500"
              />
            </div>

            {/* Valor de Referência / Liga */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Ref. Liga (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={referenceValueStr}
                onChange={(e) => setReferenceValueStr(e.target.value)}
                placeholder="0,00"
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-white text-sm font-mono focus:outline-none focus:border-crimson-500"
              />
            </div>

            {/* Preço de Venda */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Preço Venda (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={salePriceStr}
                onChange={(e) => setSalePriceStr(e.target.value)}
                placeholder="0,00"
                className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-900 border border-trigon-750 text-emerald-300 font-bold text-sm font-mono focus:outline-none focus:border-crimson-500"
              />
            </div>

            {/* Observações internas */}
            <div className="sm:col-span-12">
              <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                Observações Internas <span className="text-trigon-500 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Carta com carimbo especial de evento, pasta A2, etc."
                className="w-full px-3.5 py-2 rounded-xl bg-trigon-900 border border-trigon-750 text-white placeholder-trigon-500 text-xs focus:outline-none focus:border-crimson-500"
              />
            </div>
          </div>
        </div>

        {/* Rodapé com botões de ação */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-trigon-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            icon={<Plus className="w-4 h-4" />}
          >
            Cadastrar Carta no Estoque
          </Button>
        </div>
      </form>
    </Modal>
  );
};

