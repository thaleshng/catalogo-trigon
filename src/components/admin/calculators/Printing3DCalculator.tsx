import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { useToast } from '../../common/Toast';
import { Button } from '../../common/Button';
import { Badge } from '../../common/Badge';
import {
  Printer,
  Zap,
  Coins,
  Clock,
  Weight,
  Sparkles,
  TrendingUp,
  Sliders,
  Copy,
  Check,
  RotateCcw,
  Save,
  PlusCircle,
  ShieldAlert,
  Flame,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CalculationHistoryItem {
  id: string;
  pieceName: string;
  filamentWeightG: number;
  printTimeMinutes: number;
  filamentCost: number;
  energyCost: number;
  extraCosts: number;
  totalCost: number;
  suggestedPrice: number;
  date: string;
}

const STORAGE_KEY_DEFAULTS = 'trigon_calc_3d_presets';
const STORAGE_KEY_HISTORY = 'trigon_calc_3d_history';

export const Printing3DCalculator: React.FC = () => {
  const { success, info } = useToast();
  const [copied, setCopied] = useState(false);

  // 1. Parâmetros de Referência da Oficina (com persistência)
  const [filamentPricePerKg, setFilamentPricePerKg] = useState<number>(120.0); // R$/kg
  const [kwhPrice, setKwhPrice] = useState<number>(0.85); // R$/kWh
  const [printerPowerWatts, setPrinterPowerWatts] = useState<number>(150); // Watts médios

  // 2. Dados da Impressão Específica
  const [pieceName, setPieceName] = useState<string>('');
  const [filamentWeightG, setFilamentWeightG] = useState<number>(65); // gramas
  const [printTimeHours, setPrintTimeHours] = useState<number>(2); // horas
  const [printTimeMinutes, setPrintTimeMinutes] = useState<number>(45); // minutos adicionais

  // 3. Fatores Avançados (Custos que fazem a diferença na vida real)
  const [showAdvanced, setShowAdvanced] = useState<boolean>(true);
  const [failureRatePercent, setFailureRatePercent] = useState<number>(10); // Margem de perda/falha (%)
  const [maintenancePerHour, setMaintenancePerHour] = useState<number>(1.5); // Desgaste/bico/depreciação por hora (R$/h)
  const [laborCostFixed, setLaborCostFixed] = useState<number>(0); // Mão de obra/fatiamento/acabamento fixo (R$)
  const [profitMarginPercent, setProfitMarginPercent] = useState<number>(100); // Margem de lucro desejada (%)

  // Histórico local
  const [history, setHistory] = useState<CalculationHistoryItem[]>([]);

  // Carregar dados salvos no localStorage
  useEffect(() => {
    try {
      const savedDefaults = localStorage.getItem(STORAGE_KEY_DEFAULTS);
      if (savedDefaults) {
        const parsed = JSON.parse(savedDefaults);
        if (parsed.filamentPricePerKg !== undefined) setFilamentPricePerKg(Number(parsed.filamentPricePerKg));
        if (parsed.kwhPrice !== undefined) setKwhPrice(Number(parsed.kwhPrice));
        if (parsed.printerPowerWatts !== undefined) setPrinterPowerWatts(Number(parsed.printerPowerWatts));
        if (parsed.failureRatePercent !== undefined) setFailureRatePercent(Number(parsed.failureRatePercent));
        if (parsed.maintenancePerHour !== undefined) setMaintenancePerHour(Number(parsed.maintenancePerHour));
        if (parsed.profitMarginPercent !== undefined) setProfitMarginPercent(Number(parsed.profitMarginPercent));
      }

      const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.warn('Não foi possível restaurar presets locais da calculadora 3D', e);
    }
  }, []);

  // Salvar padrões
  const handleSaveDefaults = () => {
    try {
      const payload = {
        filamentPricePerKg,
        kwhPrice,
        printerPowerWatts,
        failureRatePercent,
        maintenancePerHour,
        profitMarginPercent,
      };
      localStorage.setItem(STORAGE_KEY_DEFAULTS, JSON.stringify(payload));
      success('Parâmetros salvos como padrão para as próximas sessões!');
    } catch {
      info('Erro ao gravar configurações no navegador.');
    }
  };

  // --- CÁLCULOS MATEMÁTICOS ---
  // Preço por grama (R$/kg / 1000)
  const pricePerGram = filamentPricePerKg > 0 ? filamentPricePerKg / 1000 : 0;

  // Tempo total em horas decimais e em minutos totais
  const totalMinutes = (Number(printTimeHours) || 0) * 60 + (Number(printTimeMinutes) || 0);
  const totalHours = totalMinutes / 60;

  // 1. Custo de Filamento = gramas gastas * preço por grama
  const filamentCost = (Number(filamentWeightG) || 0) * pricePerGram;

  // 2. Custo de Energia = (Potência em Watts * Tempo em Horas / 1000) * Preço do kWh
  const energyKwhConsumed = ((Number(printerPowerWatts) || 0) * totalHours) / 1000;
  const energyCost = energyKwhConsumed * (Number(kwhPrice) || 0);

  // 3. Custo Base Direto (Filamento + Energia)
  const rawBaseCost = filamentCost + energyCost;

  // 4. Custos Adicionais da Vida Real:
  // - Falha de impressão (% sobre o material e energia)
  const failureCost = rawBaseCost * ((Number(failureRatePercent) || 0) / 100);
  // - Desgaste de máquina e bico (R$/h * tempo)
  const maintenanceCost = totalHours * (Number(maintenancePerHour) || 0);
  // - Mão de obra / acabamento
  const laborCost = Number(laborCostFixed) || 0;

  const totalExtraCosts = failureCost + maintenanceCost + laborCost;

  // 5. CUSTO TOTAL DE PRODUÇÃO
  const totalProductionCost = rawBaseCost + totalExtraCosts;

  // 6. PREÇO SUGERIDO DE VENDA
  // Markup ou Margem percentual sobre o custo: Custo * (1 + Margem/100)
  const suggestedPrice = totalProductionCost * (1 + (Number(profitMarginPercent) || 0) / 100);
  const estimatedProfit = suggestedPrice - totalProductionCost;

  // Resetar campos de impressão
  const handleResetForm = () => {
    setPieceName('');
    setFilamentWeightG(0);
    setPrintTimeHours(0);
    setPrintTimeMinutes(0);
    setLaborCostFixed(0);
  };

  // Salvar no Histórico
  const handleSaveToHistory = () => {
    if (filamentWeightG <= 0 && totalMinutes <= 0) {
      info('Preencha ao menos o peso ou tempo da peça para salvar.');
      return;
    }

    const newItem: CalculationHistoryItem = {
      id: Date.now().toString(),
      pieceName: pieceName.trim() || 'Item sem nome',
      filamentWeightG,
      printTimeMinutes: totalMinutes,
      filamentCost,
      energyCost,
      extraCosts: totalExtraCosts,
      totalCost: totalProductionCost,
      suggestedPrice,
      date: new Date().toISOString(),
    };

    const updated = [newItem, ...history].slice(0, 10);
    setHistory(updated);
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
      success('Orçamento salvo no histórico recente!');
    } catch {
      // ignore
    }
  };

  // Limpar histórico
  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY_HISTORY);
    info('Histórico limpo.');
  };

  // Copiar resumo formatado para o WhatsApp
  const handleCopyWhatsAppQuote = () => {
    const hoursFormatted = Math.floor(totalMinutes / 60);
    const minsFormatted = totalMinutes % 60;
    const timeStr = `${hoursFormatted}h ${minsFormatted > 0 ? `${minsFormatted}min` : ''}`.trim();

    let text = `📦 *ORÇAMENTO DE IMPRESSÃO 3D — TRIGON*\n`;
    if (pieceName.trim()) {
      text += `🏷️ *Peça:* ${pieceName.trim()}\n`;
    }
    text += `⚖️ *Material gasto:* ${filamentWeightG}g de PLA\n`;
    text += `⏱️ *Tempo de impressão:* ${timeStr}\n`;
    text += `⚡ *Consumo estimado:* ${energyKwhConsumed.toFixed(2)} kWh\n`;
    text += `--------------------------------\n`;
    text += `💰 *Valor de Produção (Custo):* ${formatCurrency(totalProductionCost)}\n`;
    text += `💎 *Valor Final Sugerido:* ${formatCurrency(suggestedPrice)}\n\n`;
    text += `_Orçamento gerado pelo sistema oficial TRIGON._`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    success('Texto do orçamento copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-8">
      {/* Header com Descrição e badges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-trigon-900 via-trigon-850 to-trigon-900 border border-trigon-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-crimson-950/80 border border-crimson-600/40 flex items-center justify-center text-crimson-400 shadow-glow-crimson">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-white tracking-wide">
                Calculadora de Impressão 3D
              </h2>
              <Badge variant="danger" size="sm">
                FDM / PLA
              </Badge>
            </div>
            <p className="text-sm text-trigon-400 mt-1">
              Precifique estátuas, suportes de cartas, peças da Quest TRIGON e colecionáveis com custo real por grama e kWh.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDefaults}
            icon={<Save className="w-4 h-4 text-crimson-400" />}
          >
            Salvar Padrões da Oficina
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetForm}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            Limpar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUNA ESQUERDA: PARÂMETROS E DADOS (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Parâmetros Base de Custos (Filamento & Energia) */}
          <div className="p-6 rounded-2xl bg-trigon-900/90 border border-trigon-800/90 shadow-md space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-trigon-800">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-crimson-400" />
                <h3 className="font-semibold text-white text-base">
                  1. Parâmetros de Referência (Tarifas & Material)
                </h3>
              </div>
              <span className="text-[11px] text-trigon-400 uppercase tracking-wider font-mono">
                Base de Cálculo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Preço do kg do PLA */}
              <div>
                <label className="block text-xs font-medium text-trigon-300 mb-1.5">
                  Preço do Rolo de PLA (1 Kg)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-trigon-400 text-sm">
                    R$
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={filamentPricePerKg || ''}
                    onChange={(e) => setFilamentPricePerKg(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full pl-10 pr-4 py-2.5 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-crimson-500 transition-all"
                    placeholder="120,00"
                  />
                </div>
                {/* Exibição lateral imediata do valor por grama */}
                <div className="mt-2 flex items-center justify-between px-3 py-1.5 rounded-lg bg-crimson-950/40 border border-crimson-800/40">
                  <span className="text-xs text-trigon-400">Preço por grama (g):</span>
                  <span className="text-xs font-mono font-bold text-crimson-300">
                    {formatCurrency(pricePerGram)} / g
                  </span>
                </div>
              </div>

              {/* Preço do kWh na região */}
              <div>
                <label className="block text-xs font-medium text-trigon-300 mb-1.5">
                  Preço do kWh na Região
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-trigon-400 text-sm">
                    R$
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={kwhPrice || ''}
                    onChange={(e) => setKwhPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full pl-10 pr-4 py-2.5 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-crimson-500 transition-all"
                    placeholder="0.85"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between px-3 py-1.5 rounded-lg bg-trigon-800/50 border border-trigon-700/50">
                  <span className="text-xs text-trigon-400">Média Brasil / MG:</span>
                  <span className="text-xs font-mono text-trigon-300">~R$ 0,80 a 0,95</span>
                </div>
              </div>
            </div>

            {/* Potência da Máquina em Watts (O elo essencial para converter minutos em kWh) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-trigon-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Potência Média da Impressora (Watts)</span>
                </label>
                <span className="text-xs text-amber-400 font-mono font-semibold">
                  {printerPowerWatts} W
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="350"
                step="10"
                value={printerPowerWatts}
                onChange={(e) => setPrinterPowerWatts(parseInt(e.target.value) || 150)}
                className="w-full accent-crimson-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-trigon-400 mt-1">
                <button
                  type="button"
                  onClick={() => setPrinterPowerWatts(120)}
                  className={`hover:text-white transition-colors ${printerPowerWatts === 120 ? 'text-crimson-400 font-bold' : ''}`}
                >
                  Ender 3 / Básica (120W)
                </button>
                <button
                  type="button"
                  onClick={() => setPrinterPowerWatts(150)}
                  className={`hover:text-white transition-colors ${printerPowerWatts === 150 ? 'text-crimson-400 font-bold' : ''}`}
                >
                  Bambu Lab A1 / P1 (150W)
                </button>
                <button
                  type="button"
                  onClick={() => setPrinterPowerWatts(250)}
                  className={`hover:text-white transition-colors ${printerPowerWatts === 250 ? 'text-crimson-400 font-bold' : ''}`}
                >
                  Mesa Alta / Grande (250W)
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Dados da Peça / Impressão */}
          <div className="p-6 rounded-2xl bg-trigon-900/90 border border-trigon-800/90 shadow-md space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-trigon-800">
              <div className="flex items-center gap-2">
                <Weight className="w-5 h-5 text-crimson-400" />
                <h3 className="font-semibold text-white text-base">
                  2. Dados da Impressão (Fatiador / Slicer)
                </h3>
              </div>
              <span className="text-[11px] text-trigon-400 uppercase tracking-wider font-mono">
                Dados do Modelo
              </span>
            </div>

            {/* Nome da Peça */}
            <div>
              <label className="block text-xs font-medium text-trigon-300 mb-1.5">
                Nome da Peça ou Descrição (opcional)
              </label>
              <input
                type="text"
                value={pieceName}
                onChange={(e) => setPieceName(e.target.value)}
                placeholder="Ex: Suporte Display Charizard SAR / Busto Mewtwo"
                className="w-full px-4 py-2.5 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-crimson-500 transition-all placeholder:text-trigon-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Quantidade de PLA gasto em gramas */}
              <div>
                <label className="block text-xs font-medium text-trigon-300 mb-1.5">
                  PLA Gasto (em gramas)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={filamentWeightG || ''}
                    onChange={(e) => setFilamentWeightG(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full pl-4 pr-10 py-2.5 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-crimson-500 transition-all"
                    placeholder="Ex: 85"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-trigon-400 text-xs font-mono">
                    gramas
                  </span>
                </div>
                <p className="text-[11px] text-trigon-500 mt-1">
                  Inclua peso dos suportes e bordas (brim/raft).
                </p>
              </div>

              {/* Tempo Gasto na Impressão */}
              <div>
                <label className="block text-xs font-medium text-trigon-300 mb-1.5">
                  Tempo de Impressão (Horas e Minutos)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={printTimeHours || ''}
                      onChange={(e) => setPrintTimeHours(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-3 pr-8 py-2.5 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-crimson-500 transition-all"
                      placeholder="0"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-trigon-400 text-xs">
                      h
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={printTimeMinutes || ''}
                      onChange={(e) => setPrintTimeMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-3 pr-8 py-2.5 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-crimson-500 transition-all"
                      placeholder="0"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-trigon-400 text-xs">
                      min
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-trigon-400 mt-1 font-mono">
                  Total: {totalMinutes} minutos ({totalHours.toFixed(2)}h)
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Custos Ocultos & Margem de Lucro (A resposta para "To esquecendo de algo?") */}
          <div className="p-6 rounded-2xl bg-trigon-900/90 border border-trigon-800/90 shadow-md space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-crimson-400" />
                <div>
                  <h3 className="font-semibold text-white text-base group-hover:text-crimson-300 transition-colors">
                    3. Fatores Reais de Mercado & Lucro
                  </h3>
                  <p className="text-xs text-trigon-400">
                    O que a maioria esquece: perdas por falha, depreciação do bico/mesa e markup de venda.
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-trigon-800 flex items-center justify-center text-trigon-400 group-hover:text-white transition-colors">
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showAdvanced && (
              <div className="pt-4 border-t border-trigon-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Taxa de Falha */}
                  <div>
                    <label className="block text-xs font-medium text-trigon-300 mb-1.5 flex items-center gap-1">
                      <span>Perda / Risco de Falha</span>
                      <span className="text-[10px] text-trigon-500">({failureRatePercent}%)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={failureRatePercent}
                      onChange={(e) => setFailureRatePercent(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none"
                    />
                    <p className="text-[10px] text-trigon-500 mt-1">Geralmente 10% a 15%</p>
                  </div>

                  {/* Depreciação por Hora */}
                  <div>
                    <label className="block text-xs font-medium text-trigon-300 mb-1.5 flex items-center gap-1">
                      <span>Desgaste / Manutenção</span>
                      <span className="text-[10px] text-trigon-500">(R$/h)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={maintenancePerHour}
                      onChange={(e) => setMaintenancePerHour(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none"
                    />
                    <p className="text-[10px] text-trigon-500 mt-1">Bico, mesa, correias (~R$1,50/h)</p>
                  </div>

                  {/* Mão de Obra / Acabamento */}
                  <div>
                    <label className="block text-xs font-medium text-trigon-300 mb-1.5 flex items-center gap-1">
                      <span>Mão de Obra Fixa</span>
                      <span className="text-[10px] text-trigon-500">(R$)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={laborCostFixed || ''}
                      onChange={(e) => setLaborCostFixed(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none"
                      placeholder="0,00"
                    />
                    <p className="text-[10px] text-trigon-500 mt-1">Remoção de suporte, pintura, etc.</p>
                  </div>
                </div>

                {/* Margem de Lucro Desejada */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-trigon-300 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Margem de Lucro Desejada</span>
                    </label>
                    <span className="text-sm text-emerald-400 font-mono font-bold">
                      {profitMarginPercent}% de Margem
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    step="10"
                    value={profitMarginPercent}
                    onChange={(e) => setProfitMarginPercent(parseInt(e.target.value) || 0)}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-trigon-400 mt-1">
                    <button
                      type="button"
                      onClick={() => setProfitMarginPercent(50)}
                      className={`hover:text-white ${profitMarginPercent === 50 ? 'text-emerald-400 font-bold' : ''}`}
                    >
                      50% (Atacado)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfitMarginPercent(100)}
                      className={`hover:text-white ${profitMarginPercent === 100 ? 'text-emerald-400 font-bold' : ''}`}
                    >
                      100% (2x Custo)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfitMarginPercent(150)}
                      className={`hover:text-white ${profitMarginPercent === 150 ? 'text-emerald-400 font-bold' : ''}`}
                    >
                      150% (Padrão Maker)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfitMarginPercent(200)}
                      className={`hover:text-white ${profitMarginPercent === 200 ? 'text-emerald-400 font-bold' : ''}`}
                    >
                      200% (Exclusivo / Pintado)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: RESULTADO DA PRECIFICAÇÃO (5 colunas) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
          {/* Card Principal de Resultados */}
          <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-b from-trigon-900 via-trigon-900 to-trigon-950 border border-crimson-600/40 shadow-glow-crimson space-y-6">
            <div className="absolute top-0 right-0 w-44 h-44 bg-crimson-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-trigon-800/80">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-crimson-400" />
                <h3 className="font-cinzel text-lg font-bold text-white tracking-wide">
                  Resumo de Produção
                </h3>
              </div>
              <Badge variant="crimson" size="sm">
                Ao Vivo
              </Badge>
            </div>

            {/* Destaque 1: Custo de Produção Total */}
            <div className="p-4 rounded-2xl bg-trigon-950/80 border border-trigon-800">
              <span className="text-xs uppercase font-semibold text-trigon-400 tracking-wider block mb-1">
                Custo de Produção (Custo Real)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-cinzel text-3xl font-extrabold text-white">
                  {formatCurrency(totalProductionCost)}
                </span>
                <span className="text-xs text-trigon-500">por unidade</span>
              </div>
              <p className="text-[11px] text-trigon-400 mt-1">
                Filamento ({formatCurrency(filamentCost)}) + Energia ({formatCurrency(energyCost)})
                {totalExtraCosts > 0 && ` + Extras (${formatCurrency(totalExtraCosts)})`}
              </p>
            </div>

            {/* Destaque 2: Preço Sugerido de Venda */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-crimson-950/80 to-trigon-950 border border-crimson-500/50 shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase font-semibold text-crimson-300 tracking-wider">
                  Preço Sugerido de Venda
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  +{profitMarginPercent}% Lucro
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-cinzel text-3xl sm:text-4xl font-black text-white drop-shadow-md">
                  {formatCurrency(suggestedPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-400/90 mt-2 pt-2 border-t border-crimson-800/40">
                <span>Lucro Bruto Estimado:</span>
                <span className="font-mono font-bold">{formatCurrency(estimatedProfit)}</span>
              </div>
            </div>

            {/* Detalhamento Item a Item */}
            <div className="space-y-2.5 text-xs text-trigon-300">
              <div className="flex items-center justify-between py-1.5 border-b border-trigon-800/60">
                <span className="flex items-center gap-1.5 text-trigon-400">
                  <Weight className="w-3.5 h-3.5 text-trigon-400" />
                  Filamento ({filamentWeightG}g @ {formatCurrency(pricePerGram)}/g)
                </span>
                <span className="font-mono font-semibold text-white">
                  {formatCurrency(filamentCost)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-trigon-800/60">
                <span className="flex items-center gap-1.5 text-trigon-400">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Energia ({energyKwhConsumed.toFixed(3)} kWh @ {formatCurrency(kwhPrice)}/kWh)
                </span>
                <span className="font-mono font-semibold text-white">
                  {formatCurrency(energyCost)}
                </span>
              </div>

              {failureRatePercent > 0 && (
                <div className="flex items-center justify-between py-1.5 border-b border-trigon-800/60">
                  <span className="flex items-center gap-1.5 text-trigon-400">
                    <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
                    Reserva de Falhas ({failureRatePercent}%)
                  </span>
                  <span className="font-mono font-semibold text-white">
                    {formatCurrency(failureCost)}
                  </span>
                </div>
              )}

              {maintenancePerHour > 0 && (
                <div className="flex items-center justify-between py-1.5 border-b border-trigon-800/60">
                  <span className="flex items-center gap-1.5 text-trigon-400">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    Depreciação de Máquina ({totalHours.toFixed(1)}h)
                  </span>
                  <span className="font-mono font-semibold text-white">
                    {formatCurrency(maintenanceCost)}
                  </span>
                </div>
              )}

              {laborCostFixed > 0 && (
                <div className="flex items-center justify-between py-1.5 border-b border-trigon-800/60">
                  <span className="flex items-center gap-1.5 text-trigon-400">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Mão de Obra & Pós-processo
                  </span>
                  <span className="font-mono font-semibold text-white">
                    {formatCurrency(laborCostFixed)}
                  </span>
                </div>
              )}
            </div>

            {/* Ações Rápidas */}
            <div className="space-y-3 pt-2">
              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={handleCopyWhatsAppQuote}
                icon={copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Orçamento Copiado!' : 'Copiar Orçamento para WhatsApp'}
              </Button>

              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={handleSaveToHistory}
                icon={<PlusCircle className="w-4 h-4 text-crimson-400" />}
              >
                Guardar no Histórico Recente
              </Button>
            </div>
          </div>

          {/* Histórico Recente de Cálculos */}
          {history.length > 0 && (
            <div className="p-5 rounded-2xl bg-trigon-900 border border-trigon-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs uppercase font-bold text-trigon-300 tracking-wider">
                  Últimos Orçamentos ({history.length})
                </h4>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[11px] text-trigon-500 hover:text-crimson-400 transition-colors"
                >
                  Limpar
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-trigon-950 border border-trigon-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white truncate max-w-[160px]">
                        {item.pieceName}
                      </p>
                      <p className="text-[10px] text-trigon-400">
                        {item.filamentWeightG}g • {Math.round(item.printTimeMinutes)} min
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-white">
                        {formatCurrency(item.suggestedPrice)}
                      </p>
                      <p className="text-[10px] text-trigon-400">
                        Custo: {formatCurrency(item.totalCost)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
