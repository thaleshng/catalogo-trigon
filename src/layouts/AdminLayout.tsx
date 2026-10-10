import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { SITE_CONFIG } from '../config/site';
import { authService } from '../services/authService';
import { useToast } from '../components/common/Toast';
import {
  LayoutDashboard,
  Layers,
  Package,
  ArrowLeftRight,
  ExternalLink,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Users,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { success, error } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authService.logout();
      success('Sessão encerrada com sucesso.');
      navigate('/admin/login');
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : 'Não foi possível encerrar a sessão.';
      error(message);
    }
  };

  const navItems = [
    {
      to: '/admin',
      end: true,
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      to: '/admin/colecoes',
      end: false,
      label: 'Coleções',
      icon: <Layers className="w-5 h-5" />,
    },
    {
      to: '/admin/produtos',
      end: false,
      label: 'Produtos',
      icon: <Package className="w-5 h-5" />,
    },
    {
      to: '/admin/estoque',
      end: false,
      label: 'Controle de Estoque',
      icon: <ArrowLeftRight className="w-5 h-5" />,
    },
    {
      to: '/admin/clientes',
      end: false,
      label: 'Clientes',
      icon: <Users className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#060709] text-trigon-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-trigon-950 border-r border-trigon-800 shrink-0 select-none">
        {/* Brand header */}
        <div className="p-6 border-b border-trigon-800/80">
          <Link to="/admin" className="flex items-center gap-3">
            <img
              src={SITE_CONFIG.assets.logo}
              alt="TRIGON"
              className="w-10 h-10 object-contain filter drop-shadow-[0_2px_8px_rgba(229,34,55,0.4)]"
            />
            <div>
              <span className="font-cinzel text-lg font-bold tracking-widest text-white block">
                TRIGON
              </span>
              <span className="text-[10px] tracking-wider uppercase font-semibold text-crimson-400">
                Painel Administrativo
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-trigon-500 uppercase tracking-wider">
            Menu Principal
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-crimson-950/80 text-white border border-crimson-600/50 shadow-md shadow-crimson-950/40'
                    : 'text-trigon-400 hover:text-white hover:bg-trigon-900 border border-transparent'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="pt-6 px-3 pb-2 text-[11px] font-semibold text-trigon-500 uppercase tracking-wider">
            Ações Rápidas
          </div>
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-trigon-300 hover:text-white hover:bg-trigon-900 border border-transparent transition-all"
          >
            <div className="flex items-center gap-3">
              <ExternalLink className="w-5 h-5 text-emerald-400" />
              <span>Ver Catálogo Público</span>
            </div>
            <ChevronRight className="w-4 h-4 text-trigon-600" />
          </Link>
        </nav>

        {/* Demo status & profile card */}
        <div className="p-4 border-t border-trigon-800 bg-trigon-900/40">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-9 h-9 rounded-full bg-crimson-900/60 border border-crimson-600/40 flex items-center justify-center font-bold text-white text-xs">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">Administrador</p>
              <p className="text-[10px] text-emerald-400 truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sessão Ativa
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Encerrar Sessão"
              className="p-1.5 rounded-lg text-trigon-400 hover:text-crimson-400 hover:bg-trigon-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-trigon-950/80 backdrop-blur-md border-b border-trigon-800 px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-trigon-400 hover:text-white hover:bg-trigon-900"
              aria-label="Menu administrativo"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-crimson-500 hidden sm:block" />
              <span className="text-sm font-semibold text-white tracking-wide">
                TRIGON Admin
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/50 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Visualizar Catálogo</span>
              <span className="sm:hidden">Loja</span>
            </Link>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-trigon-400 hover:text-white bg-trigon-900 hover:bg-trigon-800 border border-trigon-800 transition-all"
              title="Sair"
            >
              <LogOut className="w-3.5 h-3.5 text-crimson-400" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-trigon-950 border-r border-trigon-800 flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="p-5 border-b border-trigon-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={SITE_CONFIG.assets.logo}
                  alt="TRIGON"
                  className="w-8 h-8 object-contain"
                />
                <span className="font-cinzel text-lg font-bold text-white tracking-wider">
                  TRIGON
                </span>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 text-trigon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-crimson-950/80 text-white border border-crimson-600/50'
                        : 'text-trigon-300 hover:text-white hover:bg-trigon-900'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}

              <div className="pt-4 border-t border-trigon-800 mt-4 space-y-1">
                <Link
                  to="/"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-emerald-400 hover:bg-trigon-900"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>Ver Catálogo Público</span>
                </Link>
                <button
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-crimson-400 hover:bg-crimson-950/30 text-left"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Encerrar Sessão</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};
