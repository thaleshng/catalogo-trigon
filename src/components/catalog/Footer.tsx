import React from 'react';
import { SITE_CONFIG } from '../../config/site';
import { MessageCircle, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-trigon-950 border-t border-trigon-800/80 text-trigon-400 mt-20 relative overflow-hidden">
      {/* Background glow gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-24 bg-gradient-to-b from-crimson-900/10 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={SITE_CONFIG.assets.logo}
                alt="TRIGON"
                className="w-11 h-11 object-contain filter drop-shadow-[0_2px_8px_rgba(229,34,55,0.3)]"
              />
              <span className="font-cinzel text-xl font-bold tracking-widest text-white">
                TRIGON
              </span>
            </div>
            <p className="text-sm text-trigon-300 max-w-md leading-relaxed">
              {SITE_CONFIG.description}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href={SITE_CONFIG.community.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-trigon-900 hover:bg-emerald-950/60 border border-trigon-800 hover:border-emerald-500/40 text-trigon-300 hover:text-emerald-400 transition-all"
                title="Grupo da Comunidade VIP"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
              <a
                href={SITE_CONFIG.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-trigon-900 hover:bg-trigon-800 border border-trigon-800 hover:border-pink-500/40 text-trigon-300 hover:text-pink-400 transition-all"
                title="Instagram"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Comunidade Oficial */}
          <div className="space-y-3 md:text-right flex flex-col md:items-end">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
              Comunidade VIP
            </h4>
            <p className="text-xs text-trigon-400 leading-relaxed max-w-sm">
              Participe do nosso grupo oficial para receber drops, novidades de lançamentos e avisos de reposição de cartas em primeira mão.
            </p>
            <a
              href={SITE_CONFIG.community.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/60 hover:border-emerald-400 transition-all pt-1"
            >
              <span>Faça parte da Comunidade</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-trigon-800/60 flex items-center justify-center text-xs text-trigon-500">
          <p>
            © {new Date().getFullYear()} TRIGON. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
