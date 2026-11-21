import React from 'react';
import {
  Boxes,
  ChefHat,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { PageId } from '../../types/supabase';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pesanan', label: 'Pesanan', icon: ClipboardList },
  { id: 'penjualan', label: 'Penjualan', icon: TrendingUp },
  { id: 'produksi', label: 'Produksi', icon: ChefHat },
  { id: 'produk', label: 'Produk', icon: Package },
  { id: 'bahan-baku', label: 'Bahan Baku', icon: Boxes },
  { id: 'pengeluaran', label: 'Pengeluaran', icon: Receipt },
  { id: 'keuangan', label: 'Keuangan', icon: Wallet },
  { id: 'laporan', label: 'Laporan', icon: FileSpreadsheet },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
];

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  businessName: string;
  adminName: string;
  userEmail?: string;
  onSignOut: () => void;
  isSigningOut?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  businessName,
  adminName,
  userEmail,
  onSignOut,
  isSigningOut = false,
}) => {
  const handleSelect = (page: PageId) => {
    onNavigate(page);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#23140C]/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#2E1A11] text-[#F7F1E8] flex flex-col border-r border-[#462B1E] transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-5 h-16 border-b border-[#462B1E]">
          <div className="min-w-0">
            <div className="text-[15px] font-display font-semibold tracking-tight text-[#FDFBF7] truncate">
              Keripik Bawang
            </div>
            <div className="text-[11px] text-[#D8B25C] truncate">
              Sistem Manajemen Bisnis
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Tutup menu navigasi"
            className="p-1.5 rounded-lg text-[#D5C3B3] hover:text-white hover:bg-[#462B1E] lg:hidden cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Menu Utama">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#C59B43] text-[#23140C] font-semibold'
                    : 'text-[#E6D9CA] hover:bg-[#3E251A] hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#23140C]' : 'text-[#C59B43]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-[#462B1E] text-xs space-y-3">
          <div>
            <div className="text-[#F7F1E8] font-medium truncate">{adminName}</div>
            {userEmail && (
              <div className="mt-0.5 text-[11px] text-[#D8B25C] truncate">
                {userEmail}
              </div>
            )}
            <div className="mt-0.5 text-[11px] text-[#BCA696] truncate">
              {businessName}
            </div>
            <div className="mt-1 text-[11px] text-[#BCA696]">
              Model: Made to Order (MTO)
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#3E251A] text-[#F7F1E8] hover:bg-[#4F3022] disabled:opacity-60 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0 text-[#D8B25C]" />
            <span>{isSigningOut ? 'Keluar...' : 'Keluar'}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
