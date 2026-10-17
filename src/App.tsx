import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/common/Toast';
import { PublicLayout } from './layouts/PublicLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Public Pages
import { HomePage } from './pages/HomePage';
import { CollectionPage } from './pages/CollectionPage';
import { CategoryPage } from './pages/CategoryPage';
import { ProductDetailPage } from './pages/ProductDetailPage';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminCollectionsPage } from './pages/admin/AdminCollectionsPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminStockPage } from './pages/admin/AdminStockPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminGiftsPage } from './pages/admin/AdminGiftsPage';
import { AdminQuestsPage } from './pages/admin/AdminQuestsPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { seedService } from './services/seedService';

export const App: React.FC = () => {
  React.useEffect(() => {
    seedService.seedIfEmpty();
  }, []);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Rotas Públicas do Catálogo */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="colecoes/:slug" element={<CollectionPage />} />
            <Route path="linhas/:slug" element={<CategoryPage />} />
            <Route path="categorias/:slug" element={<CategoryPage />} />
            <Route path="produtos/:slug" element={<ProductDetailPage />} />
          </Route>

          {/* Rota de Login Administrativo */}
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* Rotas Protegidas do Painel Administrativo */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="colecoes" element={<AdminCollectionsPage />} />
            <Route path="linhas" element={<AdminCategoriesPage />} />
            <Route path="categorias" element={<AdminCategoriesPage />} />
            <Route path="produtos" element={<AdminProductsPage />} />
            <Route path="estoque" element={<AdminStockPage />} />
            <Route path="clientes" element={<AdminCustomersPage />} />
            <Route path="brindes" element={<AdminGiftsPage />} />
            <Route path="quests" element={<AdminQuestsPage />} />
          </Route>

          {/* Fallback para rotas inexistentes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
};

export default App;
