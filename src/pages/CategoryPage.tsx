import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Category, Product } from '../types';
import { categoryService } from '../services/categoryService';
import { productService } from '../services/productService';
import { ProductCard } from '../components/catalog/ProductCard';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { FormattedText } from '../components/common/FormattedText';
import { Search, SlidersHorizontal, Boxes, ArrowLeft, PackageX } from 'lucide-react';

export const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Filtros locais
  const [searchTerm, setSearchTerm] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'inStock' | 'outOfStock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'priceAsc' | 'priceDesc'>('name');

  useEffect(() => {
    const loadCategoryAndProducts = async () => {
      if (!slug) return;
      try {
        setLoading(true);
        setNotFound(false);
        const cat = await categoryService.getCategoryBySlug(slug);

        if (!cat) {
          setNotFound(true);
          return;
        }

        setCategory(cat);
        const prods = await productService.getProducts({
          categoryId: cat.id,
          onlyActive: true,
        });
        setProducts(prods);
      } catch (err) {
        console.error('Erro ao carregar linha de produtos:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadCategoryAndProducts();
  }, [slug]);

  // Aplica busca e filtros
  const filteredProducts = products
    .filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase().trim());

      if (!matchesSearch) return false;

      if (availabilityFilter === 'inStock') {
        return p.stockQuantity > 0;
      }
      if (availabilityFilter === 'outOfStock') {
        return p.stockQuantity === 0;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priceAsc') return a.price - b.price;
      if (sortBy === 'priceDesc') return b.price - a.price;
      return a.name.localeCompare(b.name);
    });

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="p-8 rounded-2xl bg-trigon-900 border border-trigon-800 space-y-4">
          <PackageX className="w-16 h-16 text-crimson-500 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Linha de Produtos não encontrada</h2>
          <p className="text-trigon-400">
            A linha que você está tentando acessar não existe ou está temporariamente inativa.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Início</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Universo TRIGON', href: '/#universo-trigon-section' },
          { label: category?.name || 'Carregando...' },
        ]}
      />

      {/* Category Header Banner */}
      {category && (
        <div className="relative rounded-3xl overflow-hidden bg-trigon-900 border border-trigon-800 shadow-2xl">
          <div className="absolute inset-0 z-0">
            <img
              src={category.coverImage}
              alt={category.name}
              className="w-full h-full object-cover object-center filter blur-sm scale-105 opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-trigon-950 via-trigon-950/90 to-trigon-950/60" />
            <div className="absolute inset-0 bg-gradient-to-t from-trigon-950 via-transparent to-transparent" />
          </div>

          <div className="relative z-10 p-6 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-crimson-950/80 border border-crimson-600/40 text-crimson-300 text-xs font-semibold uppercase tracking-wider">
                <Boxes className="w-3.5 h-3.5" />
                <span>Linha de Produtos TRIGON</span>
              </div>
              <h1 className="font-cinzel text-3xl sm:text-5xl font-black text-white tracking-wide">
                {category.name}
              </h1>
              <p className="text-sm sm:text-base text-trigon-300 leading-relaxed">
                <FormattedText text={category.description || 'Itens selecionados para colecionadores e entusiastas.'} />
              </p>
            </div>

            <div className="flex md:flex-col items-center md:items-end gap-2 bg-trigon-950/60 p-4 rounded-2xl border border-trigon-800/80 backdrop-blur-md">
              <span className="text-xs uppercase text-trigon-400 font-medium">Itens na Linha</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white">
                {products.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div className="bg-trigon-900/80 border border-trigon-800 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-md space-y-4 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-trigon-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar produtos nesta linha..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white placeholder-trigon-500 text-sm focus:outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-trigon-400 hover:text-white"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Availability filter */}
          <div className="flex items-center rounded-xl bg-trigon-950 p-1 border border-trigon-750 text-xs font-medium">
            <button
              onClick={() => setAvailabilityFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                availabilityFilter === 'all'
                  ? 'bg-crimson-600 text-white font-semibold'
                  : 'text-trigon-400 hover:text-white'
              }`}
            >
              Todos ({products.length})
            </button>
            <button
              onClick={() => setAvailabilityFilter('inStock')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                availabilityFilter === 'inStock'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-trigon-400 hover:text-white'
              }`}
            >
              Disponíveis ({products.filter((p) => p.stockQuantity > 0).length})
            </button>
            <button
              onClick={() => setAvailabilityFilter('outOfStock')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                availabilityFilter === 'outOfStock'
                  ? 'bg-red-600 text-white font-semibold'
                  : 'text-trigon-400 hover:text-white'
              }`}
            >
              Esgotados ({products.filter((p) => p.stockQuantity === 0).length})
            </button>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-trigon-400 hidden sm:block" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-trigon-950 border border-trigon-750 text-trigon-200 text-xs sm:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-crimson-500"
            >
              <option value="name">Nome (A - Z)</option>
              <option value="priceAsc">Menor Preço</option>
              <option value="priceDesc">Maior Preço</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-72 rounded-2xl bg-trigon-900/50 border border-trigon-800 animate-pulse"
            />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-trigon-900/40 rounded-2xl border border-trigon-800 p-8 space-y-3">
          <PackageX className="w-12 h-12 text-trigon-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">Nenhum produto encontrado</h3>
          <p className="text-sm text-trigon-400 max-w-md mx-auto">
            Não encontramos nenhum produto que corresponda aos filtros aplicados nesta linha de produtos.
          </p>
          {(searchTerm || availabilityFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setAvailabilityFilter('all');
              }}
              className="mt-2 text-sm text-crimson-400 hover:underline font-semibold"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {filteredProducts.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              collectionName={category?.name}
            />
          ))}
        </div>
      )}
    </div>
  );
};
