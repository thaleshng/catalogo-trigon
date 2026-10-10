import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Product, Collection } from '../types';
import { productService } from '../services/productService';
import { collectionService } from '../services/collectionService';
import { SITE_CONFIG } from '../config/site';
import { formatCurrency } from '../utils/formatters';
import { ProductGallery } from '../components/catalog/ProductGallery';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { Badge } from '../components/common/Badge';
import { useToast } from '../components/common/Toast';
import {
  MessageCircle,
  ShieldCheck,
  Layers,
  ArrowLeft,
  Share2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [product, setProduct] = useState<Product | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { success } = useToast();

  useEffect(() => {
    const loadProductData = async () => {
      if (!slug) return;
      try {
        setLoading(true);
        setNotFound(false);
        const prod = await productService.getProductBySlug(slug);

        if (!prod) {
          setNotFound(true);
          return;
        }

        setProduct(prod);

        // Busca dados da coleção associada
        if (prod.collectionId) {
          const col = await collectionService.getCollectionById(prod.collectionId);
          setCollection(col);
        }
      } catch (err) {
        console.error('Erro ao carregar produto:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadProductData();
  }, [slug]);

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    success('Link do produto copiado para a área de transferência!');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="aspect-square rounded-2xl bg-trigon-900 animate-pulse" />
          <div className="space-y-4">
            <div className="h-6 w-32 bg-trigon-900 rounded animate-pulse" />
            <div className="h-10 w-3/4 bg-trigon-900 rounded animate-pulse" />
            <div className="h-8 w-40 bg-trigon-900 rounded animate-pulse" />
            <div className="h-32 w-full bg-trigon-900 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="p-8 rounded-2xl bg-trigon-900 border border-trigon-800 space-y-4">
          <AlertCircle className="w-16 h-16 text-crimson-500 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Produto não encontrado</h2>
          <p className="text-trigon-400">
            O item que você está procurando pode ter sido removido ou está temporariamente indisponível.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Catálogo</span>
          </Link>
        </div>
      </div>
    );
  }

  const isAvailable = product.stockQuantity > 0;
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const whatsappUrl = `https://wa.me/${SITE_CONFIG.whatsapp.number}?text=${SITE_CONFIG.whatsapp.buildPurchaseMessage(
    product.name,
    product.price,
    currentUrl
  )}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          ...(collection
            ? [{ label: collection.name, href: `/colecoes/${collection.slug}` }]
            : []),
          { label: product.name },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Gallery Column (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-28">
            <ProductGallery images={product.images} productName={product.name} />
          </div>
        </div>

        {/* Product Details Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header Tags */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {collection && (
                <Link
                  to={`/colecoes/${collection.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-trigon-900 border border-trigon-750 text-trigon-300 hover:text-crimson-400 hover:border-crimson-600/50 transition-colors"
                >
                  <Layers className="w-3 h-3 text-crimson-400" />
                  <span>{collection.name}</span>
                </Link>
              )}
              {product.rarity && (
                <Badge variant="crimson" size="md">
                  {product.rarity}
                </Badge>
              )}
            </div>

            <button
              onClick={handleShareLink}
              className="inline-flex items-center gap-1.5 text-xs text-trigon-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-trigon-900"
              title="Copiar link do produto"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartilhar</span>
            </button>
          </div>

          {/* Title */}
          <h1 className="font-cinzel text-2xl sm:text-4xl font-extrabold text-white tracking-wide leading-tight">
            {product.name}
          </h1>

          {/* Price & Stock Status Bar */}
          <div className="p-5 rounded-2xl bg-trigon-900/90 border border-trigon-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div>
              <span className="text-xs uppercase text-trigon-400 font-semibold tracking-wider block">
                Valor à Vista
              </span>
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {formatCurrency(product.price)}
              </span>
            </div>

            <div className="flex flex-col items-end">
              {isAvailable ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success" size="md" dot>
                    Disponível ({product.stockQuantity} un.)
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="danger" size="md" dot>
                    Esgotado
                  </Badge>
                </div>
              )}
              <span className="text-[11px] text-trigon-400 mt-1">
                {isAvailable ? 'Pronta entrega com envio imediato' : 'Indisponível para reserva'}
              </span>
            </div>
          </div>

          {/* CTA: Comprar pelo WhatsApp */}
          <div className="space-y-3 pt-2">
            {isAvailable ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold text-base text-white bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#29e06d] hover:to-[#17a393] shadow-lg shadow-emerald-950/50 border border-emerald-400/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 select-none text-center"
              >
                <MessageCircle className="w-6 h-6 shrink-0 fill-current" />
                <span>Comprar pelo WhatsApp</span>
              </a>
            ) : (
              <button
                disabled
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold text-base text-trigon-400 bg-trigon-800/60 border border-trigon-700/60 cursor-not-allowed select-none opacity-60"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Produto Esgotado</span>
              </button>
            )}

            <p className="text-center text-xs text-trigon-400">
              {isAvailable
                ? 'Ao clicar, você será direcionado para o WhatsApp oficial da TRIGON com os detalhes do produto preenchidos.'
                : 'Este produto encontra-se temporariamente sem unidades em estoque.'}
            </p>
          </div>

          {/* Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
            {product.language && (
              <div className="p-3 rounded-xl bg-trigon-950 border border-trigon-800">
                <span className="text-[10px] uppercase font-semibold text-trigon-400 block">
                  Idioma
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white">
                  {product.language}
                </span>
              </div>
            )}
            {product.condition && (
              <div className="p-3 rounded-xl bg-trigon-950 border border-trigon-800">
                <span className="text-[10px] uppercase font-semibold text-trigon-400 block">
                  Condição / Estado
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white">
                  {product.condition}
                </span>
              </div>
            )}
            <div className="p-3 rounded-xl bg-trigon-950 border border-trigon-800">
              <span className="text-[10px] uppercase font-semibold text-trigon-400 block">
                Garantia
              </span>
              <span className="text-xs sm:text-sm font-semibold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                100% Original
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3 pt-4 border-t border-trigon-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Descrição do Produto
            </h3>
            <div className="p-5 rounded-2xl bg-trigon-900/60 border border-trigon-800 text-sm text-trigon-200 leading-relaxed whitespace-pre-line font-light">
              {product.description}
            </div>
          </div>

          {/* Packaging & Safety Disclaimer */}
          <div className="p-4 rounded-xl bg-trigon-950/70 border border-trigon-800/80 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-crimson-400 shrink-0 mt-0.5" />
            <div className="text-xs text-trigon-300 leading-relaxed">
              <strong className="text-white block font-semibold mb-0.5">
                Padrão de Envio TRIGON:
              </strong>
              Cartas individuais enviadas em Perfect Fit + Sleeve Matte + Toploader rígido selado com team-bag contra umidade. Caixas e ETBs enviadas com plástico bolha de alta densidade e caixa reforçada.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
