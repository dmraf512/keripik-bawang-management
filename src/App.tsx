import { useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { ADMIN_USER_ID } from './lib/supabase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useBusinessData } from './context/DataContext';
import { PageId } from './types/supabase';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { NotificationToast } from './components/common/NotificationToast';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { SalesPage } from './pages/SalesPage';
import { ProductionPage } from './pages/ProductionPage';
import { ProductsPage } from './pages/ProductsPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { FinancePage } from './pages/FinancePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

function AuthenticatedWorkspace() {
  const { user, signOut, isSubmitting, authError, clearAuthError } = useAuth();
  const {
    db,
    isLoading,
    isRefreshing,
    loadError,
    notifications,
    dismissNotification,
    refreshData,
  } = useBusinessData();

  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickOrderModalOpen, setQuickOrderModalOpen] = useState(false);

  const profile = db.businessProfiles[0];
  const businessName =
    profile?.business_name || 'Usaha Keluarga Keripik Bawang';

  const handleQuickAddOrder = () => {
    setActivePage('pesanan');
    setQuickOrderModalOpen(true);
  };

  const renderPage = () => {
    if (isLoading) {
      return (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#5E3A28]">
          <Loader2 className="w-6 h-6 animate-spin text-[#362015]" />
          <p className="text-sm font-medium">
            Memuat data bisnis dari Supabase...
          </p>
        </div>
      );
    }

    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={setActivePage}
            onOpenNewOrder={handleQuickAddOrder}
          />
        );
      case 'pesanan':
        return (
          <OrdersPage
            onNavigate={setActivePage}
            externalModalOpen={quickOrderModalOpen}
            onCloseExternalModal={() => setQuickOrderModalOpen(false)}
          />
        );
      case 'penjualan':
        return <SalesPage />;
      case 'produksi':
        return <ProductionPage />;
      case 'produk':
        return <ProductsPage />;
      case 'bahan-baku':
        return <MaterialsPage />;
      case 'pengeluaran':
        return <ExpensesPage />;
      case 'keuangan':
        return <FinancePage onNavigate={setActivePage} />;
      case 'laporan':
        return <ReportsPage />;
      case 'pengaturan':
        return <SettingsPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FAF6F0] text-[#2B1B12]">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        businessName={businessName}
        adminName="Administrator"
        userEmail={user?.email ?? undefined}
        onSignOut={() => void signOut()}
        isSigningOut={isSubmitting}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activePage={activePage}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onRefreshData={() => void refreshData()}
          isRefreshing={isRefreshing}
          onQuickAddOrder={handleQuickAddOrder}
          onSignOut={() => void signOut()}
          isSigningOut={isSubmitting}
        />

        {authError && (
          <div
            role="alert"
            className="bg-[#FDF2F0] border-b border-[#F2C6BF] px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 text-xs text-[#9E2A1E] no-print"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
            <button
              type="button"
              onClick={clearAuthError}
              className="text-xs font-medium underline cursor-pointer shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="bg-[#FDF2F0] border-b border-[#F2C6BF] px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 text-xs text-[#9E2A1E] no-print"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Gagal memuat data database: {loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => void refreshData()}
              className="inline-flex items-center gap-1 text-xs font-medium underline cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Coba Lagi</span>
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {renderPage()}
        </main>
      </div>

      <NotificationToast
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </div>
  );
}

function AuthGate() {
  const { session, user, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center gap-3 text-[#2B1B12] px-4">
        <Loader2 className="w-6 h-6 animate-spin text-[#362015]" />
        <p className="text-sm font-medium text-[#5E3A28]">
          Memeriksa sesi autentikasi...
        </p>
      </div>
    );
  }

  if (!session || !user || user.id !== ADMIN_USER_ID) {
    return <LoginPage />;
  }

  return (
    <DataProvider>
      <AuthenticatedWorkspace />
    </DataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
