import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SITE_CONFIG } from '../../config/site';
import { authService } from '../../services/authService';
import { useToast } from '../../components/common/Toast';
import { Button } from '../../components/common/Button';
import { ShieldCheck, Lock, Mail, ArrowLeft, AlertCircle } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { success } = useToast();

  useEffect(() => {
    let mounted = true;

    authService
      .getUser()
      .then((user) => {
        if (mounted && user) {
          navigate('/admin', { replace: true });
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setErrorMsg(
            error instanceof Error ? error.message : 'Não foi possível verificar a sessão.',
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const result = await authService.login(email, password);
      if (result.success) {
        success('Login realizado com sucesso! Bem-vindo ao painel.');
        navigate('/admin');
      } else {
        setErrorMsg(result.error || 'Credenciais inválidas.');
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Ocorreu um erro ao processar o login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060709] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <img
          src={SITE_CONFIG.assets.heroBg}
          alt="Trigon BG"
          className="w-full h-full object-cover filter blur-md"
        />
        <div className="absolute inset-0 bg-[#060709]/80" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Back to Store */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-trigon-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Catálogo Público</span>
        </Link>

        {/* Card */}
        <div className="p-8 rounded-3xl bg-trigon-900/90 border border-trigon-800 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 mx-auto flex items-center justify-center">
              <img
                src={SITE_CONFIG.assets.logo}
                alt="TRIGON Logo"
                className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(229,34,55,0.4)]"
              />
            </div>
            <h1 className="font-cinzel text-2xl font-bold text-white tracking-wider">
              TRIGON ADMIN
            </h1>
            <p className="text-xs text-trigon-400">
              Acesso exclusivo para gerenciamento de estoque e catálogo
            </p>
          </div>

          {/* Error notice if credentials invalid */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-crimson-600/50 text-crimson-200 text-xs flex items-center gap-2.5 animate-in shake duration-150">
              <AlertCircle className="w-4 h-4 text-crimson-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-trigon-300 mb-1.5">
                E-mail Administrativo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Digite seu email"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 placeholder-trigon-600"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-trigon-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 placeholder-trigon-600"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
              icon={<ShieldCheck className="w-5 h-5" />}
            >
              Entrar no Painel
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
