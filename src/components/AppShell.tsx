import React, { useState } from 'react';
import {
  Sparkles,
  Truck,
  Store,
  CalendarDays,
  Store as StoreIcon,
  FileSpreadsheet,
  Bell,
  FolderKanban,
  Settings,
  ShoppingBag,
  Package,
  History,
  Building2,
  LogOut,
  RefreshCw,
  Calendar,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { Distributor, AppUser, Outlet, Product, Order, PredictionResult, NudgeRecord } from '../types';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';

export type DistributorTabKey = 'today' | 'outlets' | 'orders' | 'nudges' | 'catalog' | 'settings';
export type RetailerTabKey = 'restock' | 'catalog_browse' | 'history' | 'distributor_info';

interface AppShellProps {
  currentUser: AppUser;
  distributor: Distributor | null;
  outlet?: Outlet | null;
  asOfDate: string;
  isResetting: boolean;
  onReset: () => void;
  onSignOut: () => void;
  // Navigation
  distributorTab: DistributorTabKey;
  onDistributorTabChange: (tab: DistributorTabKey) => void;
  retailerTab: RetailerTabKey;
  onRetailerTabChange: (tab: RetailerTabKey) => void;
  // Quick role view switcher (e.g. testing perspective)
  activeViewRole: 'distributor' | 'retailer';
  onViewRoleChange: (role: 'distributor' | 'retailer') => void;
  // Badges count
  overdueCount?: number;
  outletsCount?: number;
  ordersCount?: number;
  nudgesCount?: number;
  productsCount?: number;
  dueProductsCount?: number;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentUser,
  distributor,
  outlet,
  asOfDate,
  isResetting,
  onReset,
  onSignOut,
  distributorTab,
  onDistributorTabChange,
  retailerTab,
  onRetailerTabChange,
  activeViewRole,
  onViewRoleChange,
  overdueCount = 0,
  outletsCount = 0,
  ordersCount = 0,
  nudgesCount = 0,
  productsCount = 0,
  dueProductsCount = 0,
  children,
}) => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const isDemo = Boolean(currentUser.is_demo || distributor?.is_demo);

  const businessName =
    activeViewRole === 'retailer'
      ? (outlet?.name || currentUser.name || 'Kirana Retail Store')
      : (distributor?.name || currentUser.name || 'Distributor Agency');

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#CCFBF1] selection:text-[#0F766E]">
      {/* 1. Persistent Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Current Business / Store Name */}
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#0F766E] flex items-center justify-center text-white shrink-0 shadow-xs">
                <Sparkles className="w-5 h-5 text-[#CCFBF1]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base sm:text-lg text-[#0F172A] tracking-tight">
                    Smart Reorder
                  </span>
                  <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    activeViewRole === 'distributor'
                      ? 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]'
                      : 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'
                  }`}>
                    {activeViewRole}
                  </span>
                  {(currentUser.is_demo || distributor?.is_demo) && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                      Demo Account
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-xs text-[#64748B]">
                  <span className="font-semibold text-[#0F172A] truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                    {businessName}
                  </span>
                  {distributor?.invite_code && activeViewRole === 'distributor' && (
                    <span className="hidden sm:inline-flex items-center font-mono font-bold text-[#0F766E] bg-[#F0FDFA] px-1.5 py-0.2 rounded border border-[#99F6E4]/70 text-[11px]">
                      Code: {distributor.invite_code}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Controls: Role Preview, Date, Reset, Account Menu */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              {/* Demo-only: preview both the Distributor and Retailer screens from one account */}
              {isDemo && (
                <div className="hidden lg:flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0] text-xs">
                  <button
                    type="button"
                    id="view-toggle-distributor"
                    onClick={() => onViewRoleChange('distributor')}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      activeViewRole === 'distributor'
                        ? 'bg-white text-[#0F766E] font-bold shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Distributor</span>
                  </button>
                  <button
                    type="button"
                    id="view-toggle-retailer"
                    onClick={() => onViewRoleChange('retailer')}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      activeViewRole === 'retailer'
                        ? 'bg-white text-[#2563EB] font-bold shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Retailer</span>
                  </button>
                </div>
              )}

              {/* As of Date Badge */}
              <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B]">
                <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                <span>As of:</span>
                <strong className="font-mono text-[#0F172A] font-semibold">{asOfDate}</strong>
              </div>

              {/* Demo-only: Reset Demo Data Button */}
              {isDemo && (
                <button
                  id="header-reset-btn"
                  type="button"
                  onClick={onReset}
                  disabled={isResetting}
                  title="Reset the demo account back to its starting sample data"
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-[#0F766E]' : ''}`} />
                  <span className="hidden sm:inline font-medium">Reset Demo Data</span>
                </button>
              )}

              {/* Account Dropdown & Sign Out */}
              <div className="relative">
                <button
                  id="account-menu-trigger-btn"
                  type="button"
                  onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                  className="flex items-center space-x-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs transition-colors cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-[#0F766E] text-white flex items-center justify-center font-bold text-[11px]">
                    {currentUser.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="font-semibold text-[#0F172A] truncate max-w-[110px]">
                      {currentUser.email}
                    </span>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isAccountMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAccountMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-[#E2E8F0] shadow-md z-50 p-2 text-xs divide-y divide-[#E2E8F0]">
                      <div className="p-2.5">
                        <span className="text-[#64748B] block text-[11px]">Signed in as</span>
                        <p className="font-bold text-[#0F172A] truncate text-sm mt-0.5">
                          {currentUser.email}
                        </p>
                        <div className="mt-1 flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            currentUser.role === 'distributor'
                              ? 'bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]'
                              : 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                          }`}>
                            Account: {currentUser.role}
                          </span>
                        </div>
                      </div>

                      {/* Demo-only: mobile perspective switch */}
                      {isDemo && (
                        <div className="p-2 lg:hidden">
                          <span className="text-[#64748B] block text-[11px] mb-1.5">Switch View:</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onViewRoleChange('distributor');
                                setIsAccountMenuOpen(false);
                              }}
                              className={`flex-1 py-1.5 px-2 rounded-md font-medium text-center ${
                                activeViewRole === 'distributor'
                                  ? 'bg-[#0F766E] text-white font-bold'
                                  : 'bg-[#F1F5F9] text-[#64748B]'
                              }`}
                            >
                              Distributor Hub
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onViewRoleChange('retailer');
                                setIsAccountMenuOpen(false);
                              }}
                              className={`flex-1 py-1.5 px-2 rounded-md font-medium text-center ${
                                activeViewRole === 'retailer'
                                  ? 'bg-[#2563EB] text-white font-bold'
                                  : 'bg-[#F1F5F9] text-[#64748B]'
                              }`}
                            >
                              Retailer Portal
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="p-1.5">
                        <button
                          type="button"
                          id="account-signout-btn"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onSignOut();
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-[#DC2626] hover:bg-[#FEE2E2]/60 rounded-lg font-semibold transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-[#DC2626]" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Persistent Nav Structure in the Same Place on Every Screen for That Role */}
        <div className="bg-[#F8FAFC] border-t border-[#E2E8F0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center space-x-1 sm:space-x-2 py-2 overflow-x-auto no-scrollbar">
              {activeViewRole === 'distributor' ? (
                <>
                  {/* Distributor Tab 1: Today's Reorders */}
                  <button
                    id="nav-tab-today"
                    type="button"
                    onClick={() => onDistributorTabChange('today')}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      distributorTab === 'today'
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span>Today&apos;s Reorders</span>
                    {overdueCount > 0 && (
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                          distributorTab === 'today'
                            ? 'bg-[#DC2626] text-white'
                            : 'bg-[#FEE2E2] text-[#DC2626]'
                        }`}
                      >
                        {overdueCount}
                      </span>
                    )}
                  </button>

                  {/* Distributor Tab 2: Outlets Directory */}
                  <button
                    id="nav-tab-outlets"
                    type="button"
                    onClick={() => onDistributorTabChange('outlets')}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      distributorTab === 'outlets'
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    <StoreIcon className="w-4 h-4" />
                    <span>Outlets</span>
                    <span
                      className={`text-[11px] font-semibold px-1.5 py-0.2 rounded-full ${
                        distributorTab === 'outlets'
                          ? 'bg-[#14B8A6] text-white'
                          : 'bg-[#E2E8F0] text-[#0F172A]'
                      }`}
                    >
                      {outletsCount}
                    </span>
                  </button>

                  {/* Distributor Tab 3: Orders Log */}
                  <button
                    id="nav-tab-orders"
                    type="button"
                    onClick={() => onDistributorTabChange('orders')}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      distributorTab === 'orders'
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Orders</span>
                    <span
                      className={`text-[11px] font-semibold px-1.5 py-0.2 rounded-full ${
                        distributorTab === 'orders'
                          ? 'bg-[#14B8A6] text-white'
                          : 'bg-[#E2E8F0] text-[#0F172A]'
                      }`}
                    >
                      {ordersCount}
                    </span>
                  </button>

                  {/* Distributor Tab 4: WhatsApp Nudges */}
                  <button
                    id="nav-tab-nudges"
                    type="button"
                    onClick={() => onDistributorTabChange('nudges')}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      distributorTab === 'nudges'
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                    <span>WhatsApp Nudges</span>
                    {nudgesCount > 0 && (
                      <span
                        className={`text-[11px] font-semibold px-1.5 py-0.2 rounded-full ${
                          distributorTab === 'nudges'
                            ? 'bg-[#14B8A6] text-white'
                            : 'bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]'
                        }`}
                      >
                        {nudgesCount}
                      </span>
                    )}
                  </button>

                  {/* Distributor Tab 5: Catalog & Pricing */}
                  <button
                    id="nav-tab-catalog"
                    type="button"
                    onClick={() => onDistributorTabChange('catalog')}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      distributorTab === 'catalog'
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    <FolderKanban className="w-4 h-4" />
                    <span>Products</span>
                    <span
                      className={`text-[11px] font-semibold px-1.5 py-0.2 rounded-full ${
                        distributorTab === 'catalog'
                          ? 'bg-[#14B8A6] text-white'
                          : 'bg-[#E2E8F0] text-[#0F172A]'
                      }`}
                    >
                      {productsCount}
                    </span>
                  </button>

                  {/* Distributor Tab 6: Business Settings */}
                  <button
                    id="nav-tab-settings"
                    type="button"
                    onClick={() => onDistributorTabChange('settings')}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      distributorTab === 'settings'
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Business Profile</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Retailer Tab 1: Restock Needed */}
                  <button
                    id="nav-tab-retailer-restock"
                    type="button"
                    onClick={() => onRetailerTabChange('restock')}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      retailerTab === 'restock'
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Restock Needed</span>
                    {dueProductsCount > 0 && (
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                          retailerTab === 'restock'
                            ? 'bg-[#D97706] text-white'
                            : 'bg-[#FEF3C7] text-[#D97706]'
                        }`}
                      >
                        {dueProductsCount}
                      </span>
                    )}
                  </button>

                  {/* Retailer Tab 2: All Products */}
                  <button
                    id="nav-tab-retailer-catalog"
                    type="button"
                    onClick={() => onRetailerTabChange('catalog_browse')}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      retailerTab === 'catalog_browse'
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>All Products</span>
                    <span
                      className={`text-[11px] font-semibold px-1.5 py-0.2 rounded-full ${
                        retailerTab === 'catalog_browse'
                          ? 'bg-[#14B8A6] text-white'
                          : 'bg-[#E2E8F0] text-[#0F172A]'
                      }`}
                    >
                      {productsCount}
                    </span>
                  </button>

                  {/* Retailer Tab 3: Order History */}
                  <button
                    id="nav-tab-retailer-history"
                    type="button"
                    onClick={() => onRetailerTabChange('history')}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      retailerTab === 'history'
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    <History className="w-4 h-4" />
                    <span>Order History</span>
                  </button>

                  {/* Retailer Tab 4: Distributor Details */}
                  <button
                    id="nav-tab-retailer-distributor"
                    type="button"
                    onClick={() => onRetailerTabChange('distributor_info')}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      retailerTab === 'distributor_info'
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>My Distributor</span>
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* 3. Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* 4. Persistent Shell Footer */}
      <footer className="bg-white border-t border-[#E2E8F0] py-4 mt-auto text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#0F172A]">Smart Reorder</span>
            <span>•</span>
            <span>Never miss a reorder</span>
          </div>
          <div className="flex items-center space-x-4 text-[#64748B]">
            {distributor?.invite_code && activeViewRole === 'distributor' && (
              <span>
                Your Invite Code:{' '}
                <strong className="text-[#0F766E] font-mono font-bold">
                  {distributor.invite_code}
                </strong>
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
