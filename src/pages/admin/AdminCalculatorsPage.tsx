import React, { useState } from 'react';
import { Printing3DCalculator } from '../../components/admin/calculators/Printing3DCalculator';
import { ProductPricingCalculator } from '../../components/admin/calculators/ProductPricingCalculator';
import { Badge } from '../../components/common/Badge';
import {
  Printer,
  Package,
} from 'lucide-react';

type CalculatorTab = '3d' | 'pricing';

export const AdminCalculatorsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CalculatorTab>('3d');

  return (
    <div className="space-y-8">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
              Central de Calculadoras
            </h1>
            <Badge variant="crimson" size="sm">
              TRIGON TOOLS
            </Badge>
          </div>
          <p className="text-sm text-trigon-400 mt-1">
            Ferramentas de precisão para custeio, precificação e tomada de decisão estratégica da loja.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1.5 rounded-2xl bg-trigon-900 border border-trigon-800 shadow-md">
          <button
            type="button"
            onClick={() => setActiveTab('3d')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === '3d'
                ? 'bg-crimson-600 text-white shadow-glow-crimson'
                : 'text-trigon-400 hover:text-white hover:bg-trigon-800/60'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Impressão 3D & Peças</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'pricing'
                ? 'bg-crimson-600 text-white shadow-glow-crimson'
                : 'text-trigon-400 hover:text-white hover:bg-trigon-800/60'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Preço de Produtos & Lotes</span>
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {activeTab === '3d' && <Printing3DCalculator />}
      {activeTab === 'pricing' && <ProductPricingCalculator />}
    </div>
  );
};
