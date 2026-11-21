import React from 'react';
import { LogOut, Menu, Plus, RefreshCw } from 'lucide-react';
import { PageId } from '../../types/supabase';
import { NAV_ITEMS } from './Sidebar';

interface TopBarProps {
  activePage: PageId;
  onOpenMobileMenu: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  onQuickAddOrder: () => void;
  onSignOut: () => void;
  isSigningOut?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activePage,
  onOpenMobileMenu,
  onRefreshData,
  isRefreshing,
  onQuickAddOrder,
  onSignOut,
  isSigningOut = false,
}) => {
  const currentItem = NAV_ITEMS.find((item) => item.id === activePage);
  const pageTitle = currentItem ? currentItem.label : 'Dashboard';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-xs border-b border-[#E5D9C8] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 no-print">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Buka menu navigasi"
          className="p-2 -ml-1 rounded-lg text-[#362015] hover:bg-[#FAF6F0] lg:hidden cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-[#8A7163] whitespace-nowrap">
            Keripik Bawang
          </span>
          <span className="hidden sm:inline text-[#C9B9A6]" aria-hidden="true">
            /
          </span>
          <h1 className="text-base font-display font-semibold text-[#2B1B12] truncate">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onRefreshData}
          disabled={isRefreshing}
          title="Muat ulang data dari Supabase"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#E5D9C8] bg-[#FAF6F0] text-[#5E3A28] hover:bg-[#F2EAE0] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          <span className="hidden md:inline">
            {isRefreshing ? 'Memuat...' : 'Segarkan'}
          </span>
        </button>

        <button
          type="button"
          onClick={onQuickAddOrder}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span>Pesanan Baru</span>
        </button>

        <button
          type="button"
          onClick={onSignOut}
          disabled={isSigningOut}
          title="Keluar dari akun"
          aria-label="Keluar dari akun"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#E5D9C8] bg-white text-[#5E3A28] hover:bg-[#FAF6F0] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>{isSigningOut ? 'Keluar...' : 'Keluar'}</span>
        </button>
      </div>
    </header>
  );
};
