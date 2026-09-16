import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { AppShell, DistributorTabKey, RetailerTabKey } from './components/AppShell';
import { LandingPage } from './components/LandingPage';
import { AuthScreen } from './components/AuthScreen';
import type { DistributorTab } from './components/DistributorDashboard';
import { CatalogManager } from './components/CatalogManager';
import { DistributorSetupModal } from './components/DistributorSetupModal';
import { FirstRunOnboarding } from './components/FirstRunOnboarding';
import {
  Distributor,
  Outlet,
  Product,
  PredictionResult,
  Order,
  AppUser,
  UserRole,
} from './types';
import { fetchDistributorByUid } from './lib/firestoreService';
import { apiFetch } from './lib/api';
import {
  getStoredUser,
  subscribeToAuth,
  logoutUser,
  fetchCurrentUser,
  loginAsDemo,
} from './lib/authService';
import { AlertTriangle, Building2, Store, Truck, MapPin, KeyRound, Check, Loader2 } from 'lucide-react';
import { BUTTON_STYLES, CARD_STYLE } from './lib/theme';

// Matches DEMO_RETAILER_ID in server.ts — lets the demo distributor account
// preview the populated retailer dashboard instead of an empty join screen.
const DEMO_RETAILER_UID = 'usr_ret_demo1';

// Lazy-loaded: a given session only ever needs ONE of these two role views,
// never both, so there's no reason to ship the other role's code in the
// initial bundle — most relevant for the retailer persona (CLAUDE.md frames
// them as a budget-phone Khatabook/Vyapar-style user, where first-load size
// is felt most).
const DistributorDashboard = lazy(() =>
  import('./components/DistributorDashboard').then(m => ({ default: m.DistributorDashboard }))
);
const RetailerView = lazy(() =>
  import('./components/RetailerView').then(m => ({ default: m.RetailerView }))
);

const RoleViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center py-24 space-y-3 text-sm text-[#64748B] animate-in fade-in duration-200">
    <Loader2 className="w-6 h-6 animate-spin text-[#0F766E]" />
    <span>Loading...</span>
  </div>
);

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(getStoredUser());
  const [authScreenMode, setAuthScreenMode] = useState<'signin' | 'signup' | null>(null);
  const [authInitialRole, setAuthInitialRole] = useState<UserRole>('distributor');

  // Navigation & Role Views
  const [activeViewRole, setActiveViewRole] = useState<'distributor' | 'retailer'>(
    currentUser?.role || 'distributor'
  );
  const [distributorTab, setDistributorTab] = useState<DistributorTabKey>('today');
  const [retailerTab, setRetailerTab] = useState<RetailerTabKey>('restock');

  // Business Data
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  // The specific outlet linked to the signed-in retailer (not just outlets[0] —
  // a distributor can have many outlets, and the wrong one showing in the header
  // is confusing for whichever retailer is actually logged in).
  const [retailerOutlet, setRetailerOutlet] = useState<Outlet | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [asOfDate, setAsOfDate] = useState<string>('2026-09-05');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Settings Modal State
  const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(false);

  // Cross-view selection targets
  const [targetOutletId, setTargetOutletId] = useState<string | undefined>();
  const [targetProductId, setTargetProductId] = useState<string | undefined>();

  // Subscribe to auth state changes and verify with backend session
  useEffect(() => {
    const unsubscribe = subscribeToAuth(user => {
      setCurrentUser(user);
      if (user) {
        setActiveViewRole(user.role || 'distributor');
      } else {
        resetBusinessData();
      }
    });

    fetchCurrentUser().catch(err => {
      console.warn('Session check warning:', err);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch all data from backend & synced database
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [distRes, outletsRes, prodsRes, predsRes, ordersRes] = await Promise.all([
        apiFetch('/api/distributor').then(r => r.json()),
        apiFetch('/api/outlets').then(r => r.json()),
        apiFetch('/api/products').then(r => r.json()),
        apiFetch('/api/predictions').then(r => r.json()),
        apiFetch('/api/orders').then(r => r.json()),
      ]);

      if (distRes.success) {
        setDistributor(distRes.data || null);
      }
      if (outletsRes.success) setOutlets(outletsRes.data);
      if (prodsRes.success) setProducts(prodsRes.data);
      if (ordersRes.success) setOrders(ordersRes.data);
      if (predsRes.success) {
        setPredictions(predsRes.data);
        if (predsRes.as_of_date) setAsOfDate(predsRes.as_of_date);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to connect to the Smart Reorder server. Please try refreshing.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  // If distributor profile exists in Firestore for this UID, check and sync
  useEffect(() => {
    if (!currentUser?.uid) return;
    let mounted = true;
    async function checkDistributor() {
      try {
        const existingDist = await fetchDistributorByUid(currentUser!.uid);
        if (mounted && existingDist) {
          setDistributor(existingDist);
        }
      } catch (err) {
        console.warn('Check distributor profile warning:', err);
      }
    }
    checkDistributor();
    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

  // Clears all business data from state so one account's data can never
  // leak into another account's session within the same page load.
  const resetBusinessData = () => {
    setDistributor(null);
    setOutlets([]);
    setProducts([]);
    setPredictions([]);
    setOrders([]);
    setRetailerOutlet(null);
  };

  // Handle user authentication from visible AuthScreen
  const handleAuthenticated = (user: AppUser) => {
    resetBusinessData();
    setCurrentUser(user);
    setAuthScreenMode(null);
    setActiveViewRole(user.role || 'distributor');
    fetchData();
  };

  // Handle user sign out
  const handleSignOut = async () => {
    await logoutUser();
    setCurrentUser(null);
    setAuthScreenMode(null);
    resetBusinessData();
  };

  // Reset database back to original seed data
  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      const res = await apiFetch('/api/reset', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setPredictions(json.data);
        if (json.as_of_date) setAsOfDate(json.as_of_date);
        await fetchData();
      }
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleDistributorSaved = (updatedDist: Distributor) => {
    setDistributor(updatedDist);
    setIsSetupModalOpen(false);
    fetchData();
  };

  // Badges calculations
  const overdueCount = useMemo(() => {
    return predictions.filter(p => p.is_due || p.status === 'overdue').length;
  }, [predictions]);

  const dueProductsCount = useMemo(() => {
    return predictions.filter(p => p.is_due || p.status === 'due_today' || p.status === 'overdue').length;
  }, [predictions]);

  const handleViewLiveDemo = async () => {
    try {
      setIsLoading(true);
      const res = await loginAsDemo('distributor');
      handleAuthenticated(res.user);
    } catch (err) {
      console.error('Failed to login as demo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if newly created distributor requires the 3-step first-run onboarding
  const needsOnboarding = useMemo(() => {
    if (!currentUser || currentUser.role !== 'distributor') return false;
    if (currentUser.is_demo || distributor?.is_demo) return false;
    return !distributor?.has_completed_onboarding && outlets.length === 0 && products.length === 0;
  }, [currentUser, distributor, outlets.length, products.length]);

  // Unauthenticated: Show Landing Page or Auth Screen
  if (!currentUser) {
    if (authScreenMode) {
      return (
        <AuthScreen
          initialMode={authScreenMode}
          initialRole={authInitialRole}
          onAuthenticated={handleAuthenticated}
          onBackToHome={() => setAuthScreenMode(null)}
        />
      );
    }

    return (
      <LandingPage
        onSelectRoleForSignUp={role => {
          setAuthInitialRole(role);
          setAuthScreenMode('signup');
        }}
        onOpenSignIn={() => {
          setAuthScreenMode('signin');
        }}
        onOpenSignUp={() => {
          setAuthInitialRole('distributor');
          setAuthScreenMode('signup');
        }}
        onViewLiveDemo={handleViewLiveDemo}
      />
    );
  }

  // If newly registered distributor hasn't added outlets/products yet, show the guided first-run flow
  if (needsOnboarding && distributor) {
    return (
      <FirstRunOnboarding
        distributor={distributor}
        onCompleted={updated => {
          setDistributor(updated);
          fetchData();
        }}
      />
    );
  }

  // Map AppShell distributorTab to DistributorDashboard internal tab
  const handleDistributorTabChange = (tab: DistributorTabKey) => {
    setDistributorTab(tab);
    if (tab === 'settings') {
      setIsSetupModalOpen(true);
    }
  };

  return (
    <AppShell
      currentUser={currentUser}
      distributor={distributor}
      outlet={retailerOutlet}
      asOfDate={asOfDate}
      isResetting={isResetting}
      onReset={handleReset}
      onSignOut={handleSignOut}
      distributorTab={distributorTab}
      onDistributorTabChange={handleDistributorTabChange}
      retailerTab={retailerTab}
      onRetailerTabChange={setRetailerTab}
      activeViewRole={activeViewRole}
      onViewRoleChange={setActiveViewRole}
      overdueCount={overdueCount}
      outletsCount={outlets.length}
      ordersCount={orders.length}
      productsCount={products.length}
      dueProductsCount={dueProductsCount}
    >
      {/* Error notification banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="px-3 py-1 bg-[#FECACA] hover:bg-[#FCA5A5] text-[#7F1D1D] font-semibold rounded-lg text-xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Role Content Views */}
      <Suspense fallback={<RoleViewLoadingFallback />}>
      {activeViewRole === 'distributor' ? (
        <>
          {/* Tabs: Today / Outlets / Orders / Nudges */}
          {(distributorTab === 'today' ||
            distributorTab === 'outlets' ||
            distributorTab === 'orders' ||
            distributorTab === 'nudges') && (
            <DistributorDashboard
              predictions={predictions}
              outlets={outlets}
              products={products}
              orders={orders}
              isLoading={isLoading}
              asOfDate={asOfDate}
              onRefreshData={fetchData}
              activeTab={distributorTab as DistributorTab}
              onTabChange={(tab: DistributorTab) => setDistributorTab(tab)}
            />
          )}

          {/* Tab: Catalog Manager */}
          {distributorTab === 'catalog' && (
            <CatalogManager
              distributor={
                distributor || {
                  id: currentUser.uid,
                  name: currentUser.name || 'Your Business',
                  route: '',
                  invite_code: '',
                }
              }
              outlets={outlets}
              products={products}
              onDataUpdated={fetchData}
              onOpenBusinessSetup={() => setIsSetupModalOpen(true)}
            />
          )}

          {/* Tab: Agency Settings */}
          {distributorTab === 'settings' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className={`${CARD_STYLE} p-6 sm:p-8 space-y-6`}>
                <div className="flex items-center space-x-3.5 border-b border-[#E2E8F0] pb-5">
                  <div className="w-12 h-12 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] flex items-center justify-center text-[#0F766E]">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">
                      Business Settings
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Your business name, delivery area, invite code, and payment details.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
                      Business Name
                    </span>
                    <span className="text-sm font-bold text-[#0F172A]">
                      {distributor?.name || currentUser.name || 'Not set yet'}
                    </span>
                  </div>

                  <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
                      Delivery Area
                    </span>
                    <span className="text-sm font-bold text-[#0F172A] flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#0F766E]" />
                      <span>{distributor?.route || 'Not set yet'}</span>
                    </span>
                  </div>

                  <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
                      Your Retailer Invite Code
                    </span>
                    <span className="text-sm font-mono font-bold text-[#0F766E]">
                      {distributor?.invite_code || 'Not set yet'}
                    </span>
                  </div>

                  <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
                      UPI ID for Payments
                    </span>
                    <span className="text-sm font-mono font-bold text-[#0F172A]">
                      {distributor?.upi_id || 'Not set yet'}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSetupModalOpen(true)}
                    className={`${BUTTON_STYLES.primary} text-xs py-2.5 px-4`}
                  >
                    Edit Business Details
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Retailer View */
        <RetailerView
          outlets={outlets}
          products={products}
          predictions={predictions}
          orders={orders}
          distributor={distributor}
          asOfDate={asOfDate}
          initialOutletId={targetOutletId}
          initialProductId={targetProductId}
          onOrderPlaced={fetchData}
          onOutletResolved={setRetailerOutlet}
          activeTab={retailerTab}
          onActiveTabChange={setRetailerTab}
          previewAsUid={
            currentUser.role === 'distributor' && (currentUser.is_demo || distributor?.is_demo)
              ? DEMO_RETAILER_UID
              : undefined
          }
        />
      )}
      </Suspense>

      {/* Distributor Setup / Settings Modal */}
      {currentUser?.uid && (
        <DistributorSetupModal
          isOpen={isSetupModalOpen}
          onClose={() => setIsSetupModalOpen(false)}
          uid={currentUser.uid}
          initialDistributor={distributor}
          onSaved={handleDistributorSaved}
        />
      )}
    </AppShell>
  );
}
