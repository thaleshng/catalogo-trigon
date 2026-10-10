import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { authService } from '../../services/authService';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = authService.onAuthStateChange((sessionUser) => {
      if (mounted) {
        setUser(sessionUser);
        setLoading(false);
        setError(null);
      }
    });

    authService
      .getUser()
      .then((sessionUser) => {
        if (mounted) {
          setUser(sessionUser);
        }
      })
      .catch((reason: unknown) => {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : 'Falha ao verificar a sessão.');
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-[#060709]" aria-label="Verificando sessão" />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#060709] p-6 text-center text-red-300" role="alert">
        Não foi possível verificar sua sessão: {error}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
