import React from 'react';
import { Link } from 'react-router-dom';
import { SITE_CONFIG } from '../../config/site';
import { Users } from 'lucide-react';

export const Navbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 bg-trigon-950/90 backdrop-blur-md border-b border-trigon-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand Name */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="relative w-12 h-12 flex items-center justify-center transition-all duration-300">
              <img
                src={SITE_CONFIG.assets.logo}
                alt="TRIGON Logo"
                className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(229,34,55,0.3)] transform group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-cinzel text-2xl font-black tracking-widest text-white group-hover:text-crimson-400 transition-colors">
                TRIGON
              </span>
              <span className="text-[10px] tracking-wider uppercase text-trigon-400 font-semibold -mt-1">
                TCG & Colecionáveis
              </span>
            </div>
          </Link>

          {/* Right Action: Community Group */}
          <div className="flex items-center gap-4">
            <a
              href={SITE_CONFIG.community.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-950/50 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60 hover:border-emerald-400 hover:text-white transition-all shadow-sm group"
              title="Acessar grupo VIP no WhatsApp"
            >
              <Users className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Faça parte da Comunidade</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
