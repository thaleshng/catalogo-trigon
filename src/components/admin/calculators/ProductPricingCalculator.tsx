import React, { useState, useEffect, useRef } from 'react';
import { Product, Collection } from '../../../types';
import { productService } from '../../../services/productService';
import { collectionService } from '../../../services/collectionService';
import { formatCurrency } from '../../../utils/formatters';
import { useToast } from '../../common/Toast';
import { Button } from '../../common/Button';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import {
  Package,
  Layers,
  Plus,
  Trash2,
  AlertTriangle,
  Copy,
  Check,
  Store,
  Flame,
  Sparkles,
  Link as LinkIcon,
  HelpCircle,
  ShoppingBag,
  Filter,
  Search,
  Eye,
  Table,
} from 'lucide-react';

export interface LotGroup {
  id: string;
  productId: string;
  quantity: number;
  purchasePrice: number; // Preço pago por unidade (R$)
  profitPercent: number; // % de lucro desejado sobre o valor de mercado (ex: 30%)
  notes?: string;
}

type ChannelType = 'comunidade' | 'jamble';

export const ProductPricingCalculator: React.FC = () => {
  const { success, error, info } = useToast();

  // Produtos e Coleções cadastrados no sistema
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Filtros de Coleção e Busca por Grupo
  const [groupCollectionFilters, setGroupCollectionFilters] = useState<Record<string, string>>({});
  const [groupSearchFilters, setGroupSearchFilters] = useState<Record<string, string>>({});

  // Canal de venda: Comunidade (0%) ou Jamble (+10%)
  const [channel, setChannel] = useState<ChannelType>('comunidade');

  // Valores de Mercado Sincronizados por Produto (productId -> marketPrice)
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});

  // Grupos / Lotes
  const [groups, setGroups] = useState<LotGroup[]>([]);

  // Estado de cópia para WhatsApp
  const [copied, setCopied] = useState(false);
  const [updatingCatalog, setUpdatingCatalog] = useState<string | null>(null);

  // Modal de Tabela Consolidada de Preços
  const [isPriceTableModalOpen, setIsPriceTableModalOpen] = useState(false);
  const [updatingAll, setUpdatingAll] = useState(false);

  // Alertas visuais de PAGO > MERCADO gerenciados com debounce de 2s e onBlur imediato
  const [activeOverpaidAlerts, setActiveOverpaidAlerts] = useState<Record<string, boolean>>({});
  const overpaidTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Avaliação com debounce (espera o usuário parar de digitar por 2 segundos)
  const triggerDebouncedOverpaidCheck = (
    groupId: string,
    purchasePrice: number,
    marketPrice: number
  ) => {
    if (overpaidTimersRef.current[groupId]) {
      clearTimeout(overpaidTimersRef.current[groupId]);
    }
    overpaidTimersRef.current[groupId] = setTimeout(() => {
      const isOver = purchasePrice > marketPrice && marketPrice > 0;
      setActiveOverpaidAlerts((prev) => ({
        ...prev,
        [groupId]: isOver,
      }));
    }, 2000);
  };

  // Avaliação imediata ao sair do campo (onBlur)
  const handleBlurOverpaidCheck = (
    groupId: string,
    purchasePrice: number,
    marketPrice: number
  ) => {
    if (overpaidTimersRef.current[groupId]) {
      clearTimeout(overpaidTimersRef.current[groupId]);
    }
    const isOver = purchasePrice > marketPrice && marketPrice > 0;
    setActiveOverpaidAlerts((prev) => ({
      ...prev,
      [groupId]: isOver,
    }));
  };

  // Carregar produtos e coleções cadastrados
  useEffect(() => {
    const fetchCatalogData = async () => {
      try {
        setLoadingProducts(true);
        const [prodsData, colsData] = await Promise.all([
          productService.getProducts(),
          collectionService.getCollections(false),
        ]);
        setProducts(prodsData);
        setCollections(colsData);

        // Se houver produtos e a lista de grupos estiver vazia, inicializar com 1 grupo
        if (prodsData.length > 0 && groups.length === 0) {
          const firstProduct = prodsData[0];
          setMarketPrices({ [firstProduct.id]: firstProduct.price });
          setGroups([
            {
              id: 'group-1',
              productId: firstProduct.id,
              quantity: 2,
              purchasePrice: Math.round(firstProduct.price * 0.7), // sugestão padrão 70% de compra
              profitPercent: 30,
            },
          ]);
        }
      } catch (err: any) {
        console.error('Erro ao carregar catálogo e coleções:', err);
        error('Falha ao buscar produtos e coleções do catálogo.');
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchCatalogData();
  }, []);

  // Sincroniza o valor de mercado de um produto em todos os grupos que o utilizam
  const handleMarketPriceChange = (productId: string, newPrice: number) => {
    const validPrice = Math.max(0, newPrice || 0);
    setMarketPrices((prev) => ({
      ...prev,
      [productId]: validPrice,
    }));

    // Dispara debounce de 2s para os grupos afetados por essa cotação
    groups
      .filter((g) => g.productId === productId)
      .forEach((g) => {
        triggerDebouncedOverpaidCheck(g.id, Number(g.purchasePrice) || 0, validPrice);
      });
  };

  // Alterar produto selecionado em um grupo
  const handleProductChange = (groupId: string, newProductId: string) => {
    const selectedProd = products.find((p) => p.id === newProductId);
    if (!selectedProd) return;

    // Se este produto ainda não tiver valor de mercado no dicionário, inicializa com o preço de tabela dele
    if (marketPrices[newProductId] === undefined) {
      setMarketPrices((prev) => ({
        ...prev,
        [newProductId]: selectedProd.price,
      }));
    }

    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, productId: newProductId } : g))
    );
  };

  // Alterar campo de um grupo
  const handleGroupFieldChange = (
    groupId: string,
    field: keyof LotGroup,
    val: any
  ) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          [field]: val,
        };
      })
    );
  };

  // Adicionar um novo grupo ao lote
  const handleAddGroup = (baseProductId?: string) => {
    const targetProdId = baseProductId || (products.length > 0 ? products[0].id : '');
    const selectedProd = products.find((p) => p.id === targetProdId);

    if (targetProdId && marketPrices[targetProdId] === undefined && selectedProd) {
      setMarketPrices((prev) => ({
        ...prev,
        [targetProdId]: selectedProd.price,
      }));
    }

    const newGroup: LotGroup = {
      id: `group-${Date.now()}`,
      productId: targetProdId,
      quantity: 1,
      purchasePrice: selectedProd ? Math.round(selectedProd.price * 0.7) : 50,
      profitPercent: 30,
    };

    setGroups((prev) => [...prev, newGroup]);
  };

  // Duplicar grupo para cadastrar outra remessa do mesmo produto com preço pago diferente
  const handleDuplicateWithSameProduct = (groupId: string) => {
    const source = groups.find((g) => g.id === groupId);
    if (!source) return;

    const newGroup: LotGroup = {
      id: `group-${Date.now()}`,
      productId: source.productId,
      quantity: 1,
      purchasePrice: source.purchasePrice,
      profitPercent: source.profitPercent,
    };

    setGroups((prev) => [...prev, newGroup]);

    if (groupCollectionFilters[groupId]) {
      setGroupCollectionFilters((prev) => ({
        ...prev,
        [newGroup.id]: groupCollectionFilters[groupId],
      }));
    }
    if (groupSearchFilters[groupId]) {
      setGroupSearchFilters((prev) => ({
        ...prev,
        [newGroup.id]: groupSearchFilters[groupId],
      }));
    }

    info('Novo grupo do mesmo produto adicionado para registrar preço pago diferente.');
  };

  // Remover grupo
  const handleRemoveGroup = (groupId: string) => {
    if (groups.length <= 1) {
      info('O lote precisa conter pelo menos 1 grupo.');
      return;
    }
    if (overpaidTimersRef.current[groupId]) {
      clearTimeout(overpaidTimersRef.current[groupId]);
    }
    setActiveOverpaidAlerts((prev) => {
      const copy = { ...prev };
      delete copy[groupId];
      return copy;
    });

    setGroups((prev) => prev.filter((g) => g.id !== groupId));

    setGroupCollectionFilters((prev) => {
      const copy = { ...prev };
      delete copy[groupId];
      return copy;
    });
    setGroupSearchFilters((prev) => {
      const copy = { ...prev };
      delete copy[groupId];
      return copy;
    });
  };

  // Sincroniza a porcentagem de lucro de um produto em todos os grupos daquele produto
  const handleProfitPercentChange = (productId: string, newPercent: number) => {
    const valid = Math.max(0, newPercent || 0);
    setGroups((prev) =>
      prev.map((g) => (g.productId === productId ? { ...g, profitPercent: valid } : g))
    );
  };

  // Fixar preço base para bater exatamente 100% da cotação de mercado
  const handleAlignWithMarket = (productId: string) => {
    const market = marketPrices[productId] || 0;
    if (market <= 0) return;

    // Calcula o custo médio ponderado atual deste produto no lote
    const productGroups = groups.filter((g) => g.productId === productId);
    const totalQty = productGroups.reduce(
      (acc, g) => acc + Math.max(1, Number(g.quantity) || 1),
      0
    );
    const totalCost = productGroups.reduce(
      (acc, g) =>
        acc + (Number(g.purchasePrice) || 0) * Math.max(1, Number(g.quantity) || 1),
      0
    );
    const avgCost = totalQty > 0 ? totalCost / totalQty : 0;

    // Se Preço Base = Custo Médio + (Mercado * %Lucro / 100) = Mercado
    // Então %Lucro = ((Mercado - Custo Médio) / Mercado) * 100
    const desiredPercent = ((market - avgCost) / market) * 100;
    handleProfitPercentChange(productId, Math.round(desiredPercent * 10) / 10);
    info('Margem ajustada para o preço de venda unificado bater exatamente a cotação de mercado!');
  };

  // Atualizar o preço no catálogo Supabase
  const handleApplyToCatalog = async (productId: string, finalPrice: number) => {
    try {
      setUpdatingCatalog(productId);
      await productService.updateProduct(productId, { price: finalPrice });
      // Atualizar lista local
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, price: finalPrice } : p))
      );
      success('Preço atualizado no catálogo da TRIGON com sucesso!');
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar preço no catálogo.');
    } finally {
      setUpdatingCatalog(null);
    }
  };

  // --- CÁLCULOS MATEMÁTICOS CONSOLIDADOS (PREÇO UNIFICADO POR PRODUTO) ---
  interface ProductSummary {
    productId: string;
    product?: Product;
    totalQuantity: number;
    totalCost: number; // soma de (purchasePrice * quantity)
    weightedPurchasePrice: number; // totalCost / totalQuantity
    marketPrice: number;
    profitPercent: number;
    profitAmountUnit: number; // marketPrice * (profitPercent / 100)
    basePriceUnit: number; // weightedPurchasePrice + profitAmountUnit
    finalPriceUnit: number; // channel === 'jamble' ? basePriceUnit * 1.1 : basePriceUnit
    totalRevenue: number; // finalPriceUnit * totalQuantity
    totalNetProfit: number;
    unitNetProfit: number;
    isOverpaidAverage: boolean;
    groupCount: number;
  }

  const productSummaries: Record<string, ProductSummary> = {};

  // Passo 1: Totaliza quantidade e custo pago para cada produto
  groups.forEach((g) => {
    const prodId = g.productId;
    const qty = Math.max(1, Number(g.quantity) || 1);
    const cost = (Number(g.purchasePrice) || 0) * qty;

    if (!productSummaries[prodId]) {
      const product = products.find((p) => p.id === prodId);
      const marketPrice = marketPrices[prodId] ?? (product?.price || 0);
      const profitPercent = Number(g.profitPercent) || 0;

      productSummaries[prodId] = {
        productId: prodId,
        product,
        totalQuantity: 0,
        totalCost: 0,
        weightedPurchasePrice: 0,
        marketPrice,
        profitPercent,
        profitAmountUnit: 0,
        basePriceUnit: 0,
        finalPriceUnit: 0,
        totalRevenue: 0,
        totalNetProfit: 0,
        unitNetProfit: 0,
        isOverpaidAverage: false,
        groupCount: 0,
      };
    }

    productSummaries[prodId].totalQuantity += qty;
    productSummaries[prodId].totalCost += cost;
    productSummaries[prodId].groupCount += 1;
  });

  // Passo 2: Calcula o preço de venda unificado para o produto como um todo
  Object.values(productSummaries).forEach((summary) => {
    summary.weightedPurchasePrice =
      summary.totalQuantity > 0 ? summary.totalCost / summary.totalQuantity : 0;
    summary.isOverpaidAverage =
      summary.weightedPurchasePrice > summary.marketPrice && summary.marketPrice > 0;

    summary.profitAmountUnit = (summary.marketPrice * summary.profitPercent) / 100;
    summary.basePriceUnit = summary.weightedPurchasePrice + summary.profitAmountUnit;
    summary.finalPriceUnit =
      channel === 'jamble' ? summary.basePriceUnit * 1.1 : summary.basePriceUnit;

    summary.totalRevenue = summary.finalPriceUnit * summary.totalQuantity;
    const netRevenueReceived =
      channel === 'jamble' ? summary.totalRevenue * 0.9 : summary.totalRevenue;
    summary.totalNetProfit = netRevenueReceived - summary.totalCost;
    summary.unitNetProfit =
      summary.totalQuantity > 0 ? summary.totalNetProfit / summary.totalQuantity : 0;
  });

  // Gravar todos os produtos deste lote no catálogo de uma só vez
  const handleApplyAllToCatalog = async () => {
    const summariesList = Object.values(productSummaries);
    if (summariesList.length === 0) return;

    try {
      setUpdatingAll(true);
      const updates = summariesList.map((s) => ({
        id: s.productId,
        price: s.finalPriceUnit,
      }));

      await Promise.all(
        updates.map((u) => productService.updateProduct(u.id, { price: u.price }))
      );

      setProducts((prev) =>
        prev.map((p) => {
          const match = updates.find((u) => u.id === p.id);
          return match ? { ...p, price: match.price } : p;
        })
      );
      success(`Todos os ${updates.length} produtos foram gravados no catálogo da loja com sucesso!`);
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar todos os produtos no catálogo.');
    } finally {
      setUpdatingAll(false);
    }
  };

  // Passo 3: Mapeia cada grupo no lote referenciando o preço e custo unificado do produto
  const groupCalculations = groups.map((g) => {
    const summary = productSummaries[g.productId];
    const product = summary?.product || products.find((p) => p.id === g.productId);
    const marketPrice = summary ? summary.marketPrice : (marketPrices[g.productId] ?? (product?.price || 0));
    const purchasePrice = Number(g.purchasePrice) || 0;
    const quantity = Math.max(1, Number(g.quantity) || 1);
    const profitPercent = summary ? summary.profitPercent : (Number(g.profitPercent) || 0);

    const isOverpaid = purchasePrice > marketPrice && marketPrice > 0;
    const finalPriceUnit = summary ? summary.finalPriceUnit : 0;
    const basePriceUnit = summary ? summary.basePriceUnit : 0;
    const weightedPurchasePrice = summary ? summary.weightedPurchasePrice : purchasePrice;
    const unitNetProfit = summary ? summary.unitNetProfit : 0;

    const totalPurchaseCost = purchasePrice * quantity;
    const totalMarketValue = marketPrice * quantity;
    const totalFinalRevenue = finalPriceUnit * quantity;

    return {
      group: g,
      product,
      marketPrice,
      purchasePrice,
      quantity,
      profitPercent,
      isOverpaid,
      finalPriceUnit,
      basePriceUnit,
      weightedPurchasePrice,
      unitNetProfit,
      totalPurchaseCost,
      totalMarketValue,
      totalFinalRevenue,
      productSummary: summary,
    };
  });

  // TOTAIS CONSOLIDADOS DO LOTE
  const totalUnits = groupCalculations.reduce((acc, c) => acc + c.quantity, 0);
  const totalInvestedCost = groupCalculations.reduce((acc, c) => acc + c.totalPurchaseCost, 0);
  const totalMarketVal = groupCalculations.reduce((acc, c) => acc + c.totalMarketValue, 0);
  const totalProjectedRevenue = groupCalculations.reduce((acc, c) => acc + c.totalFinalRevenue, 0);
  const totalProjectedProfit = groupCalculations.reduce(
    (acc, c) =>
      acc +
      (channel === 'jamble'
        ? c.totalFinalRevenue * 0.9 - c.totalPurchaseCost
        : c.totalFinalRevenue - c.totalPurchaseCost),
    0
  );

  // Preço Médio Ponderado pago por unidade
  const weightedAverageCost = totalUnits > 0 ? totalInvestedCost / totalUnits : 0;
  // Margem Geral Consolidada (%)
  const overallMarginPercent =
    totalProjectedRevenue > 0 ? (totalProjectedProfit / totalProjectedRevenue) * 100 : 0;

  // Quantidade de grupos em alerta (overpaid)
  const overpaidCount = groupCalculations.filter((c) => c.isOverpaid).length;

  // Copiar resumo formatado para o WhatsApp / Comunidade / Jamble (Agrupado por Produto Unificado)
  const handleCopySummary = () => {
    let text = `📦 *TABELA DE PRECIFICAÇÃO — TRIGON*\n`;
    text += `📍 *Canal:* ${channel === 'jamble' ? 'Jamble (+10% taxa)' : 'Comunidade VIP / WhatsApp'}\n`;
    text += `⚖️ *Total de Peças:* ${totalUnits} un.\n`;
    text += `--------------------------------\n`;

    Object.values(productSummaries).forEach((prodSummary, idx) => {
      const prodName = prodSummary.product?.name || 'Produto não cadastrado';
      text += `${idx + 1}. *${prodName}* (${prodSummary.totalQuantity}x un.)\n`;
      text += `   • Custo Médio Pago: ${formatCurrency(prodSummary.weightedPurchasePrice)}/un\n`;
      text += `   • Cotação Mercado: ${formatCurrency(prodSummary.marketPrice)}\n`;
      text += `   • Preço Venda Un.: *${formatCurrency(prodSummary.finalPriceUnit)}*\n`;
      text += `   • Subtotal (${prodSummary.totalQuantity}x): ${formatCurrency(prodSummary.totalRevenue)}\n`;
    });

    text += `--------------------------------\n`;
    text += `💰 *Valor Total do Lote:* ${formatCurrency(totalProjectedRevenue)}\n`;
    text += `_Preços unificados gerados pela Central de Calculadoras TRIGON._`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    success('Resumo copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 3000);
  };

  // Se ainda estiver carregando produtos
  if (loadingProducts) {
    return (
      <div className="p-12 text-center rounded-2xl bg-trigon-900 border border-trigon-800 space-y-4">
        <div className="w-8 h-8 border-2 border-crimson-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-trigon-400">Carregando catálogo de produtos cadastrados...</p>
      </div>
    );
  }

  // Se não houver produtos cadastrados no sistema
  if (products.length === 0) {
    return (
      <div className="p-8 sm:p-12 rounded-3xl bg-trigon-900 border border-trigon-800 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-600/40 text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="font-cinzel text-xl font-bold text-white">Nenhum produto cadastrado</h3>
        <p className="text-sm text-trigon-400 max-w-md mx-auto">
          Como regra obrigatória, a calculadora de preços consulta os produtos cadastrados no sistema. Cadastre seus produtos no menu &ldquo;Produtos&rdquo; antes de precificar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner: Configurações Globais do Cálculo */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-trigon-900 via-trigon-850 to-trigon-900 border border-trigon-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-white tracking-wide">
              Calculadora de Preço de Produtos & Lotes
            </h2>
            <Badge variant="crimson" size="sm">
              REGRA DE MERCADO
            </Badge>
          </div>
          <p className="text-sm text-trigon-400">
            Precifique cartas e lotes com referência de mercado sincronizada, controle de custo de aquisição e taxa de canal.
          </p>
        </div>

        {/* Seletores Globais: Canal de Venda e Ações */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Canal */}
          <div className="flex items-center p-1 rounded-xl bg-trigon-950 border border-trigon-750">
            <button
              type="button"
              onClick={() => setChannel('comunidade')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                channel === 'comunidade'
                  ? 'bg-crimson-600 text-white shadow-glow-crimson'
                  : 'text-trigon-400 hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Comunidade (Direto)</span>
            </button>

            <button
              type="button"
              onClick={() => setChannel('jamble')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                channel === 'jamble'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-trigon-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Jamble (+10%)</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddGroup()}
            icon={<Plus className="w-4 h-4 text-crimson-400" />}
          >
            Adicionar ao Lote
          </Button>
        </div>
      </div>

      {/* Alerta Global se houver produtos comprados acima do mercado */}
      {overpaidCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-600/50 shadow-md flex items-start sm:items-center gap-3 animate-pulse">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          <div className="text-xs text-amber-200">
            <span className="font-bold">Atenção Crítica:</span> Você possui{' '}
            <strong className="underline text-white font-mono">{overpaidCount} grupo(s)</strong> no
            lote onde o valor pago é superior à cotação de mercado. Verifique os destaques em
            vermelho para não ter prejuízo.
          </div>
        </div>
      )}

      {/* Layout Principal: Lista de Grupos (Esquerda) e Resumo Consolidado (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUNA ESQUERDA: GRUPOS DO LOTE (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-trigon-800">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-crimson-400" />
              <h3 className="font-semibold text-white text-base">
                Grupos de Produtos no Lote ({groups.length})
              </h3>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsPriceTableModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-trigon-800/80 hover:bg-crimson-950/80 border border-trigon-700 hover:border-crimson-600/60 text-xs text-trigon-200 hover:text-white transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Visualizar tabela consolidada com todos os produtos e preços do lote"
              >
                <Eye className="w-3.5 h-3.5 text-crimson-400" />
                <span className="font-medium">Tabela Geral</span>
              </button>
              <span className="hidden sm:inline text-xs text-trigon-400">
                Mesmo produto = Cotação sincronizada
              </span>
            </div>
          </div>

          {/* Cards dos Grupos */}
          <div className="space-y-4">
            {groupCalculations.map((calc, index) => {
              const {
                group,
                product,
                marketPrice,
                purchasePrice,
                profitPercent,
                finalPriceUnit,
                unitNetProfit,
              } = calc;

              // Alerta visual de PAGO > MERCADO com debounce de 2s / onBlur para digitação suave
              const isOverpaid = activeOverpaidAlerts[group.id] ?? calc.isOverpaid;

              // Verifica se existem outros grupos compartilhando o mesmo produto
              const sameProductCount = groups.filter((g) => g.productId === group.productId).length;

              // Filtros de coleção e busca específicos deste grupo
              const activeColId = groupCollectionFilters[group.id] || 'ALL';
              const searchKW = (groupSearchFilters[group.id] || '').trim().toLowerCase();

              const groupFilteredProducts = products.filter((p) => {
                // Sempre mantém o produto selecionado atualmente para manter a consistência
                if (p.id === group.productId) return true;

                if (activeColId !== 'ALL' && p.collectionId !== activeColId) {
                  return false;
                }

                if (searchKW) {
                  const nameMatches = p.name.toLowerCase().includes(searchKW);
                  const rarityMatches = p.rarity ? p.rarity.toLowerCase().includes(searchKW) : false;
                  if (!nameMatches && !rarityMatches) return false;
                }

                return true;
              });

              return (
                <div
                  key={group.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isOverpaid
                      ? 'bg-crimson-950/30 border-crimson-600/80 shadow-md shadow-crimson-950/40'
                      : 'bg-trigon-900/90 border-trigon-800/90 shadow-md'
                  }`}
                >
                  {/* Top Bar do Grupo */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-trigon-800/60">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-trigon-800 border border-trigon-700 flex items-center justify-center font-mono font-bold text-xs text-trigon-200">
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-trigon-300">
                        Grupo #{index + 1}
                      </span>

                      {sameProductCount > 1 && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full bg-crimson-950/90 border border-crimson-700 text-crimson-300 font-medium">
                          <LinkIcon className="w-3 h-3" />
                          <span>Produto Vinculado ({sameProductCount} lotes • Preço Unificado)</span>
                        </span>
                      )}

                      {isOverpaid && (
                        <Badge variant="danger" size="sm">
                          PAGO &gt; MERCADO
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDuplicateWithSameProduct(group.id)}
                        className="p-1.5 rounded-lg text-trigon-400 hover:text-white hover:bg-trigon-800 transition-colors text-xs flex items-center gap-1"
                        title="Adicionar outra remessa deste mesmo produto com preço de compra diferente"
                      >
                        <Plus className="w-3.5 h-3.5 text-crimson-400" />
                        <span className="hidden sm:inline text-[11px]">Nova Remessa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveGroup(group.id)}
                        className="p-1.5 rounded-lg text-trigon-500 hover:text-crimson-400 hover:bg-trigon-800 transition-colors"
                        title="Remover grupo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Seleção do Produto Cadastrado com Filtro de Coleção e Busca */}
                  <div className="mb-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-medium text-trigon-300 flex items-center gap-1">
                        <span>Produto Cadastrado no Sistema</span>
                        <span className="text-crimson-500 font-bold">*</span>
                      </label>

                      {/* Controles de Filtro: Coleção & Busca */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Filtro de Coleção do Grupo */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-trigon-950 border border-trigon-750">
                          <Filter className="w-3 h-3 text-crimson-400 shrink-0" />
                          <select
                            value={activeColId}
                            onChange={(e) => {
                              const newCol = e.target.value;
                              setGroupCollectionFilters((prev) => ({
                                ...prev,
                                [group.id]: newCol,
                              }));
                              // Se o produto atual não pertencer à nova coleção e houver itens nela, seleciona o primeiro daquela coleção
                              if (newCol !== 'ALL') {
                                const firstInCol = products.find((p) => p.collectionId === newCol);
                                if (firstInCol && firstInCol.id !== group.productId) {
                                  handleProductChange(group.id, firstInCol.id);
                                }
                              }
                            }}
                            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer max-w-[150px] truncate"
                          >
                            <option value="ALL" className="bg-trigon-900">
                              Todas as Coleções ({products.length})
                            </option>
                            {collections.map((col) => {
                              const count = products.filter((p) => p.collectionId === col.id).length;
                              return (
                                <option key={col.id} value={col.id} className="bg-trigon-900">
                                  {col.name} ({count})
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Busca Rápida por Nome da Carta */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Buscar carta..."
                            value={groupSearchFilters[group.id] || ''}
                            onChange={(e) =>
                              setGroupSearchFilters((prev) => ({
                                ...prev,
                                [group.id]: e.target.value,
                              }))
                            }
                            className="w-28 sm:w-36 pl-7 pr-2 py-1 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-lg text-xs text-white placeholder:text-trigon-600 focus:outline-none"
                          />
                          <Search className="w-3 h-3 text-trigon-500 absolute left-2 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    </div>

                    {/* Dropdown de Produtos Filtrados */}
                    <div className="relative">
                      <select
                        value={group.productId}
                        onChange={(e) => handleProductChange(group.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none transition-all appearance-none cursor-pointer"
                      >
                        {groupFilteredProducts.length === 0 ? (
                          <option value="" disabled>
                            Nenhum produto encontrado com este filtro
                          </option>
                        ) : (
                          groupFilteredProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.rarity ? `(${p.rarity})` : ''} — Catálogo: {formatCurrency(p.price)}
                            </option>
                          ))
                        )}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-trigon-400">
                        <Package className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-trigon-500 px-1">
                      <span>Exibindo {groupFilteredProducts.length} produto(s) correspondente(s)</span>
                      {activeColId !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => {
                            setGroupCollectionFilters((prev) => ({ ...prev, [group.id]: 'ALL' }));
                            setGroupSearchFilters((prev) => ({ ...prev, [group.id]: '' }));
                          }}
                          className="text-crimson-400 hover:text-crimson-300 underline"
                        >
                          Limpar Filtro
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grid de Entradas: Qtd, Valor Pago, Valor de Mercado, % Lucro */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Quantidade */}
                    <div>
                      <label className="block text-[11px] font-medium text-trigon-400 mb-1">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={group.quantity || ''}
                        onChange={(e) =>
                          handleGroupFieldChange(
                            group.id,
                            'quantity',
                            Math.max(1, parseInt(e.target.value) || 1)
                          )
                        }
                        className="w-full px-3 py-2 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none"
                      />
                    </div>

                    {/* Valor Pago Unitário */}
                    <div>
                      <label className="block text-[11px] font-medium text-trigon-400 mb-1">
                        Valor Pago Un. (R$)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={group.purchasePrice || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          handleGroupFieldChange(group.id, 'purchasePrice', val);
                          triggerDebouncedOverpaidCheck(group.id, val, marketPrice);
                        }}
                        onBlur={() => {
                          handleBlurOverpaidCheck(group.id, Number(group.purchasePrice) || 0, marketPrice);
                        }}
                        className={`w-full px-3 py-2 bg-trigon-950 border rounded-xl text-sm font-semibold focus:outline-none transition-colors duration-200 ${
                          isOverpaid
                            ? 'border-crimson-500 text-crimson-200 font-mono'
                            : 'border-trigon-750 text-white focus:border-crimson-500'
                        }`}
                        placeholder="0,00"
                      />
                    </div>

                    {/* Valor de Mercado Unitário (Sincronizado) */}
                    <div>
                      <label className="block text-[11px] font-medium text-trigon-400 mb-1 flex items-center justify-between">
                        <span>Mercado Un. (R$)</span>
                        {sameProductCount > 1 && (
                          <span title="Sincronizado com outros lotes deste produto">
                            <LinkIcon className="w-3 h-3 text-crimson-400" />
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={marketPrice || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          handleMarketPriceChange(group.productId, val);
                        }}
                        onBlur={() => {
                          handleBlurOverpaidCheck(group.id, Number(group.purchasePrice) || 0, marketPrice);
                        }}
                        className="w-full px-3 py-2 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none transition-colors duration-200"
                        placeholder="0,00"
                      />
                    </div>

                    {/* Porcentagem de Lucro Desejada */}
                    <div>
                      <label className="block text-[11px] font-medium text-trigon-400 mb-1 flex items-center justify-between">
                        <span>% Lucro s/ Mercado</span>
                        {sameProductCount > 1 && (
                          <span title="Margem de lucro sincronizada para este produto em todos os lotes">
                            <LinkIcon className="w-3 h-3 text-crimson-400" />
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          value={profitPercent}
                          onChange={(e) =>
                            handleProfitPercentChange(
                              group.productId,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full pl-3 pr-7 py-2 bg-trigon-950 border border-trigon-750 focus:border-crimson-500 rounded-xl text-white text-sm font-semibold focus:outline-none"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-trigon-500 text-xs">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Banner Explicativo de Preço Unificado quando houver múltiplos lotes do mesmo produto */}
                  {sameProductCount > 1 && (
                    <div className="mt-3 p-3 rounded-xl bg-trigon-950/90 border border-trigon-750 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-crimson-950/80 border border-crimson-800/60 flex items-center justify-center text-crimson-400 shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-white font-medium flex items-center gap-2">
                            <span>Preço Unificado por Custo Médio Ponderado</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-crimson-950 text-crimson-300 border border-crimson-800 font-semibold">
                              {sameProductCount} lotes deste produto
                            </span>
                          </div>
                          <p className="text-[11px] text-trigon-400">
                            Custo Médio: <strong className="text-white font-mono">{formatCurrency(calc.weightedPurchasePrice)}/un</strong> ({calc.productSummary?.totalQuantity} un. totalizando {formatCurrency(calc.productSummary?.totalCost || 0)} investidos)
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-trigon-400 block">Venda Unificada</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">
                          {formatCurrency(finalPriceUnit)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Alerta de Custo Superior ao Mercado */}
                  {isOverpaid && (
                    <div className="mt-3 p-2.5 rounded-xl bg-crimson-950/70 border border-crimson-600/60 flex items-center gap-2 text-xs text-crimson-200 animate-in fade-in duration-300">
                      <AlertTriangle className="w-4 h-4 text-crimson-400 shrink-0" />
                      <span>
                        Neste lote você pagou <strong>{formatCurrency(purchasePrice)}</strong>, mas a cotação é{' '}
                        <strong>{formatCurrency(marketPrice)}</strong> (R${' '}
                        {(purchasePrice - marketPrice).toFixed(2)} acima do mercado).
                      </span>
                    </div>
                  )}

                  {/* Barra de Ações e Prévia do Preço Deste Grupo */}
                  <div className="mt-4 pt-3 border-t border-trigon-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAlignWithMarket(group.productId)}
                        className="text-[11px] text-trigon-400 hover:text-crimson-300 underline transition-colors cursor-pointer"
                      >
                        Igualar ao Valor de Mercado
                      </button>

                      {product && (
                        <button
                          type="button"
                          onClick={() => handleApplyToCatalog(product.id, finalPriceUnit)}
                          disabled={updatingCatalog === product.id}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 underline transition-colors cursor-pointer flex items-center gap-1"
                          title="Atualizar o preço de tabela deste item no banco da loja"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>
                            {updatingCatalog === product.id ? 'Atualizando...' : 'Gravar no Catálogo'}
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-trigon-400">
                        Venda Unitária ({channel === 'jamble' ? 'Jamble +10%' : 'Comunidade'}):
                      </span>
                      <span className="font-mono font-bold text-white text-sm">
                        {formatCurrency(finalPriceUnit)}
                      </span>
                      <span className="text-[11px] text-emerald-400 font-mono">
                        (Lucro: +{formatCurrency(unitNetProfit)}/un)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            variant="outline"
            className="w-full justify-center py-3"
            onClick={() => handleAddGroup()}
            icon={<Plus className="w-4 h-4 text-crimson-400" />}
          >
            Adicionar Outro Grupo / Produto ao Lote
          </Button>
        </div>

        {/* COLUNA DIREITA: RESULTADOS CONSOLIDADOS (5 colunas) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
          <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-b from-trigon-900 via-trigon-900 to-trigon-950 border border-crimson-600/40 shadow-glow-crimson space-y-6">
            <div className="absolute top-0 right-0 w-44 h-44 bg-crimson-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-trigon-800/80">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-crimson-400" />
                <h3 className="font-cinzel text-lg font-bold text-white tracking-wide">
                  Totalizador do Lote
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPriceTableModalOpen(true)}
                  className="p-1 rounded-lg text-trigon-400 hover:text-white hover:bg-trigon-800 transition-colors cursor-pointer"
                  title="Abrir Tabela Geral em Modal"
                >
                  <Eye className="w-4 h-4 text-crimson-400" />
                </button>
                <Badge variant={channel === 'jamble' ? 'warning' : 'crimson'} size="sm">
                  {channel === 'jamble' ? 'CANAL JAMBLE' : 'CANAL COMUNIDADE'}
                </Badge>
              </div>
            </div>

            {/* Destaque Principal: Faturamento Total Projetado */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-crimson-950/80 to-trigon-950 border border-crimson-500/50 shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase font-semibold text-crimson-300 tracking-wider">
                  Faturamento Total Projetado
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {totalUnits} unidades
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-cinzel text-3xl sm:text-4xl font-black text-white drop-shadow-md">
                  {formatCurrency(totalProjectedRevenue)}
                </span>
              </div>
              <p className="text-[11px] text-trigon-400 mt-1">
                {channel === 'jamble'
                  ? 'Inclui os 10% de repasse de taxa da plataforma Jamble.'
                  : 'Venda direta sem taxas de terceiros.'}
              </p>
            </div>

            {/* Métricas Financeiras Consolidadas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-trigon-950/80 border border-trigon-800">
                <span className="text-[10px] uppercase font-semibold text-trigon-400 tracking-wider block mb-0.5">
                  Investimento Total
                </span>
                <p className="font-mono text-base font-bold text-white">
                  {formatCurrency(totalInvestedCost)}
                </p>
                <p className="text-[10px] text-trigon-500 mt-0.5">Soma dos valores pagos</p>
              </div>

              <div className="p-3.5 rounded-xl bg-trigon-950/80 border border-trigon-800">
                <span className="text-[10px] uppercase font-semibold text-emerald-400 tracking-wider block mb-0.5">
                  Lucro Líquido Real
                </span>
                <p className="font-mono text-base font-bold text-emerald-400">
                  {formatCurrency(totalProjectedProfit)}
                </p>
                <p className="text-[10px] text-emerald-400/80 mt-0.5">
                  Margem: {overallMarginPercent.toFixed(1)}%
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-trigon-950/80 border border-trigon-800">
                <span className="text-[10px] uppercase font-semibold text-trigon-400 tracking-wider block mb-0.5">
                  Custo Médio / Unidade
                </span>
                <p className="font-mono text-base font-bold text-trigon-200">
                  {formatCurrency(weightedAverageCost)}
                </p>
                <p className="text-[10px] text-trigon-500 mt-0.5">Média ponderada do lote</p>
              </div>

              <div className="p-3.5 rounded-xl bg-trigon-950/80 border border-trigon-800">
                <span className="text-[10px] uppercase font-semibold text-trigon-400 tracking-wider block mb-0.5">
                  Valor Mercado Total
                </span>
                <p className="font-mono text-base font-bold text-trigon-200">
                  {formatCurrency(totalMarketVal)}
                </p>
                <p className="text-[10px] text-trigon-500 mt-0.5">Cotação bruta</p>
              </div>
            </div>

            {/* Informação sobre a Regra da Jamble */}
            {channel === 'jamble' && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-xs text-amber-200 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Regra Jamble Ativa:</strong> Cada produto teve 10% adicionado ao valor
                  final para neutralizar a comissão cobrada na venda.
                </span>
              </div>
            )}

            {/* Ações */}
            <div className="space-y-3 pt-2">
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => setIsPriceTableModalOpen(true)}
                icon={<Table className="w-4 h-4 text-crimson-400" />}
              >
                Ver Tabela Geral de Preços ({Object.keys(productSummaries).length})
              </Button>

              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={handleCopySummary}
                icon={copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Tabela Copiada!' : 'Copiar Lista para WhatsApp / Jamble'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE TABELA CONSOLIDADA DE PREÇOS */}
      <Modal
        isOpen={isPriceTableModalOpen}
        onClose={() => setIsPriceTableModalOpen(false)}
        title="Tabela Consolidada de Preços do Lote"
        description="Visão geral e unificada de todos os produtos do lote, custos médios ponderados e preços sugeridos de venda."
        maxWidth="5xl"
      >
        <div className="space-y-6">
          {/* Top Bar do Modal */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-trigon-950 border border-trigon-800">
            <div className="flex items-center gap-3">
              <Badge variant={channel === 'jamble' ? 'warning' : 'crimson'} size="sm">
                {channel === 'jamble' ? 'CANAL JAMBLE (+10% taxa)' : 'CANAL COMUNIDADE (0% taxa)'}
              </Badge>
              <span className="text-xs text-trigon-400">
                {Object.keys(productSummaries).length} produtos únicos no lote ({totalUnits} unidades totais)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySummary}
                icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-trigon-400" />}
              >
                {copied ? 'Copiado!' : 'Copiar Formato WhatsApp'}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleApplyAllToCatalog}
                disabled={updatingAll || Object.keys(productSummaries).length === 0}
                icon={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
              >
                {updatingAll ? 'Gravando Todos...' : 'Gravar Todos no Catálogo'}
              </Button>
            </div>
          </div>

          {/* Tabela de Produtos */}
          <div className="overflow-x-auto rounded-2xl border border-trigon-800 bg-trigon-950/60 shadow-inner">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-trigon-800 bg-trigon-900/90 text-trigon-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 font-semibold">Produto Cadastrado</th>
                  <th className="py-3.5 px-3 font-semibold text-center">Qtd Total</th>
                  <th className="py-3.5 px-3 font-semibold text-right">Custo Médio</th>
                  <th className="py-3.5 px-3 font-semibold text-right">Total Investido</th>
                  <th className="py-3.5 px-3 font-semibold text-right">Cotação Mercado</th>
                  <th className="py-3.5 px-3 font-semibold text-center">% Lucro</th>
                  <th className="py-3.5 px-4 font-semibold text-right text-emerald-400">Preço Venda Un.</th>
                  <th className="py-3.5 px-4 font-semibold text-right text-emerald-400">Lucro Líquido</th>
                  <th className="py-3.5 px-3 font-semibold text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trigon-800/60">
                {Object.values(productSummaries).map((summary) => {
                  const prod = summary.product;
                  return (
                    <tr key={summary.productId} className="hover:bg-trigon-900/50 transition-colors">
                      {/* Produto */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {prod?.images && prod.images.length > 0 ? (
                            <img
                              src={prod.images[0]}
                              alt={prod.name}
                              className="w-10 h-10 object-cover rounded-xl border border-trigon-750 shrink-0 bg-trigon-900"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-trigon-900 border border-trigon-800 flex items-center justify-center text-trigon-500 shrink-0">
                              <Package className="w-5 h-5 text-trigon-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-white text-xs truncate max-w-[200px] sm:max-w-[260px]" title={prod?.name}>
                              {prod?.name || 'Produto não encontrado'}
                            </div>
                            <div className="text-[10px] text-trigon-400 flex items-center gap-1.5 mt-0.5">
                              {prod?.rarity && (
                                <span className="text-crimson-400 font-medium">{prod.rarity}</span>
                              )}
                              <span>• Catálogo: {formatCurrency(prod?.price || 0)}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Qtd Total */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-mono font-bold text-white text-xs">
                          {summary.totalQuantity} un.
                        </span>
                        {summary.groupCount > 1 && (
                          <span className="block text-[9px] text-crimson-400 font-medium">
                            {summary.groupCount} remessas
                          </span>
                        )}
                      </td>

                      {/* Custo Médio Pago */}
                      <td className="py-3.5 px-3 text-right font-mono text-trigon-200">
                        {formatCurrency(summary.weightedPurchasePrice)}
                      </td>

                      {/* Total Investido */}
                      <td className="py-3.5 px-3 text-right font-mono text-trigon-200">
                        {formatCurrency(summary.totalCost)}
                      </td>

                      {/* Cotação Mercado */}
                      <td className="py-3.5 px-3 text-right font-mono text-trigon-300">
                        {formatCurrency(summary.marketPrice)}
                      </td>

                      {/* % Lucro */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded bg-trigon-900 border border-trigon-750 font-mono text-white text-[11px]">
                          {summary.profitPercent}%
                        </span>
                        <span className="block text-[9px] text-emerald-400/90 font-mono mt-0.5">
                          +{formatCurrency(summary.profitAmountUnit)}/un
                        </span>
                      </td>

                      {/* Preço Venda Un. */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-bold text-white text-sm">
                          {formatCurrency(summary.finalPriceUnit)}
                        </div>
                        <span className="text-[9px] text-trigon-400">
                          {channel === 'jamble' ? 'Repasse Jamble' : 'Comunidade'}
                        </span>
                      </td>

                      {/* Lucro Líquido */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 text-xs">
                        +{formatCurrency(summary.totalNetProfit)}
                      </td>

                      {/* Ação */}
                      <td className="py-3.5 px-3 text-center">
                        {prod && (
                          <button
                            type="button"
                            onClick={() => handleApplyToCatalog(prod.id, summary.finalPriceUnit)}
                            disabled={updatingCatalog === prod.id}
                            className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/70 text-emerald-300 hover:text-white transition-all text-[11px] font-medium flex items-center gap-1 mx-auto disabled:opacity-50 cursor-pointer shadow-sm"
                            title="Atualizar preço deste produto no catálogo da TRIGON"
                          >
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            <span>{updatingCatalog === prod.id ? 'Gravando...' : 'Gravar'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-trigon-900/95 border-t-2 border-trigon-750 font-semibold text-white">
                  <td className="py-3.5 px-4 font-cinzel text-xs">
                    Totais do Lote ({Object.keys(productSummaries).length} produtos)
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-bold text-emerald-400">
                    {totalUnits} un.
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-trigon-300 text-[11px]">
                    Méd: {formatCurrency(weightedAverageCost)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-white">
                    {formatCurrency(totalInvestedCost)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-trigon-300">
                    {formatCurrency(totalMarketVal)}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-emerald-400">
                    {overallMarginPercent.toFixed(1)}% margem
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-sm">
                    {formatCurrency(totalProjectedRevenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                    +{formatCurrency(totalProjectedProfit)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Rodapé do Modal com Informações e Fechar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-trigon-800">
            <span className="text-[11px] text-trigon-400">
              * Ao clicar em &ldquo;Gravar&rdquo; ou &ldquo;Gravar Todos&rdquo;, o novo preço unitário sugerido é salvo no catálogo Supabase da TRIGON.
            </span>
            <Button variant="outline" size="sm" onClick={() => setIsPriceTableModalOpen(false)}>
              Fechar Tabela
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
