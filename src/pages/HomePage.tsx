import React, { useEffect, useState } from 'react';
import { Collection, Category } from '../types';
import { collectionService } from '../services/collectionService';
import { categoryService } from '../services/categoryService';
import { CollectionCard } from '../components/catalog/CollectionCard';
import { CategoryCard } from '../components/catalog/CategoryCard';
import { ShowcaseSlider } from '../components/catalog/ShowcaseSlider';
import { SITE_CONFIG } from '../config/site';
import {
  Shield,
  Sparkles,
  Truck,
  Users,
  ChevronDown,
  Flame,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collectionCounts, setCollectionCounts] = useState<Record<string, number>>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [cols, colCounts, cats, catCounts] = await Promise.all([
          collectionService.getCollections(true), // apenas coleções ativas
          collectionService.getCollectionProductCounts(),
          categoryService.getCategories(true), // apenas linhas ativas
          categoryService.getCategoryProductCounts(),
        ]);
        setCollections(cols);
        setCollectionCounts(colCounts);
        setCategories(cats);
        setCategoryCounts(catCounts);
      } catch (err) {
        console.error('Erro ao carregar dados da página inicial:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const scrollToCollections = () => {
    document.getElementById('colecoes-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero Section: Clean, Minimalist & Ultra-Elegant Dark Luxury */}
      <section className="relative min-h-[540px] sm:min-h-[620px] flex items-center justify-center overflow-hidden border-b border-trigon-800/80 bg-[#060709]">
        {/* Subtle Luxury Atmospheric Lighting (sem imagem pesada de fundo) */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Radial crimson ambient glow behind emblem */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[950px] h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(229,34,55,0.18)_0%,rgba(229,34,55,0.03)_50%,transparent_75%)]" />
          {/* Subtle micro-grid accent */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-30" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center py-16 sm:py-24 flex flex-col items-center">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-crimson-950/80 border border-crimson-600/50 text-crimson-300 text-xs uppercase tracking-widest font-semibold mb-6 backdrop-blur-md shadow-glow-crimson animate-pulse">
            <Flame className="w-3.5 h-3.5 text-crimson-400" />
            <span>O Santuário do Pokémon TCG</span>
          </div>

          {/* Crisp, Pristine Logo Emblem with Soft Crimson Aura */}
          <div className="relative mb-6">
            <div className="absolute -inset-6 bg-crimson-600/25 rounded-full blur-3xl opacity-80" />
            <img
              src={SITE_CONFIG.assets.logo}
              alt="Emblema TRIGON"
              className="relative w-28 h-28 sm:w-36 sm:h-36 object-contain filter drop-shadow-[0_12px_28px_rgba(229,34,55,0.45)] transform hover:scale-105 transition-transform duration-500"
            />
          </div>

          <h1 className="font-cinzel text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-wider sm:tracking-widest uppercase drop-shadow-md">
            CATÁLOGO{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-trigon-200 to-crimson-400">
              TRIGON
            </span>
          </h1>

          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-trigon-300 max-w-2xl font-light leading-relaxed">
            Cartas raras, caixas seladas, edições comemorativas e coleções oficiais de Pokémon TCG com negociação direta e transparente.
          </p>

          {/* Action CTAs: Explorar Coleções & Faça parte da Comunidade */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={scrollToCollections}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-crimson-700 via-crimson-600 to-crimson-700 hover:from-crimson-600 hover:to-crimson-500 shadow-glow-crimson border border-crimson-500/40 hover:border-crimson-400 transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              <span>Explorar Coleções</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            <a
              href={SITE_CONFIG.community.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 hover:border-emerald-400 hover:text-white transition-all transform hover:-translate-y-0.5 shadow-sm group"
            >
              <Users className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Faça parte da Comunidade</span>
            </a>
          </div>

          {/* Highlights / Trust Features */}
          <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl pt-8 border-t border-trigon-800/80">
            <div className="flex items-center justify-center sm:justify-start gap-3 p-3.5 rounded-xl bg-trigon-950/70 border border-trigon-800/80 backdrop-blur-sm">
              <Shield className="w-5 h-5 text-crimson-400 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold text-white uppercase tracking-wide">100% Autêntico</p>
                <p className="text-[11px] text-trigon-400">Cartas e produtos selados originais</p>
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-3 p-3.5 rounded-xl bg-trigon-950/70 border border-trigon-800/80 backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold text-white uppercase tracking-wide">Conservação Impecável</p>
                <p className="text-[11px] text-trigon-400">Proteção com sleeves e toploaders</p>
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-3 p-3.5 rounded-xl bg-trigon-950/70 border border-trigon-800/80 backdrop-blur-sm">
              <Truck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold text-white uppercase tracking-wide">Envio Blindado</p>
                <p className="text-[11px] text-trigon-400">Embalagem segura para todo o Brasil</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Collections Section: Fully Centered with Responsive Sliding Carousel */}
      <section id="colecoes-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Centered Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold tracking-widest uppercase text-crimson-400">
            Catálogo Oficial
          </span>
          <h2 className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mt-1.5 tracking-wide">
            Coleções em Destaque
          </h2>
          <p className="text-sm sm:text-base text-trigon-400 mt-2.5 leading-relaxed">
            Selecione uma coleção para visualizar todos os singles, caixas seladas e edições comemorativas oficiais.
          </p>
        </div>

        {/* Carousel / Slider Container */}
        {loading ? (
          <div className="flex justify-center gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-80 h-96 rounded-2xl bg-trigon-900/60 border border-trigon-800 animate-pulse"
              />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-16 bg-trigon-900/40 rounded-2xl border border-trigon-800 max-w-md mx-auto">
            <p className="text-base text-trigon-300">Nenhuma coleção disponível no momento.</p>
          </div>
        ) : (
          <ShowcaseSlider
            items={collections}
            getKey={(col) => col.id}
            prevAriaLabel="Coleção anterior"
            nextAriaLabel="Próxima coleção"
            renderItem={(col) => (
              <CollectionCard
                collection={col}
                productCount={collectionCounts[col.id] || 0}
              />
            )}
          />
        )}
      </section>

      {/* Second Showcase: Explore o Universo TRIGON (Linhas de Produtos) */}
      {!loading && categories.length > 0 && (
        <section id="universo-trigon-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          {/* Centered Header */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold tracking-widest uppercase text-crimson-400">
              Além das Cartas
            </span>
            <h2 className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mt-1.5 tracking-wide">
              Explore o Universo TRIGON
            </h2>
            <p className="text-sm sm:text-base text-trigon-400 mt-2.5 leading-relaxed">
              De acessórios essenciais a criações em 3D, descubra tudo que vai além das cartas.
            </p>
          </div>

          <ShowcaseSlider
            items={categories}
            getKey={(cat) => cat.id}
            prevAriaLabel="Linha anterior"
            nextAriaLabel="Próxima linha"
            renderItem={(cat) => (
              <CategoryCard
                category={cat}
                productCount={categoryCounts[cat.id] || 0}
              />
            )}
          />
        </section>
      )}
    </div>
  );
};
