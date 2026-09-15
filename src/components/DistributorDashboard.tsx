import React, { useState, useEffect } from 'react';
import { PredictionResult, Outlet, Product, Order, NudgeRecord } from '../types';
import { TodayTab } from './TodayTab';
import { OutletsTab } from './OutletsTab';
import { OrdersTab } from './OrdersTab';
import { NudgesTab } from './NudgesTab';
import { ImportFromPhotoModal } from './ImportFromPhotoModal';
import {
  CalendarDays,
  Store,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Send,
  X,
  Bell,
  Camera,
} from 'lucide-react';
import { fetchNudgesFromDb, createNudgeInDb } from '../lib/firestoreService';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';

export type DistributorTab = 'today' | 'outlets' | 'orders' | 'nudges';

interface DistributorDashboardProps {
  predictions: PredictionResult[];
  outlets: Outlet[];
  products: Product[];
  orders: Order[];
  isLoading: boolean;
  asOfDate: string;
  onRefreshData: () => Promise<void>;
  activeTab?: DistributorTab;
  onTabChange?: (tab: DistributorTab) => void;
}

export const DistributorDashboard: React.FC<DistributorDashboardProps> = ({
  predictions,
  outlets,
  products,
  orders,
  isLoading,
  asOfDate,
  onRefreshData,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<DistributorTab>('today');
  const activeTab = controlledTab || internalTab;
  const setActiveTab = (t: DistributorTab) => {
    if (onTabChange) {
      onTabChange(t);
    } else {
      setInternalTab(t);
    }
  };

  const [nudges, setNudges] = useState<NudgeRecord[]>([]);
  const [isPhotoImportOpen, setIsPhotoImportOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'info';
    text: string;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const loadNudges = async () => {
    try {
      const data = await fetchNudgesFromDb();
      setNudges(data);
    } catch (err) {
      console.warn('Failed to load nudges from Firestore:', err);
    }
  };

  useEffect(() => {
    loadNudges();
  }, [asOfDate]);

  const handleLogNudge = async (outletId: string, productId: string) => {
    const outlet = outlets.find(o => o.id === outletId);
    const product = products.find(p => p.id === productId);

    const outletName = outlet?.name || outletId;
    const productName = product?.name || productId;
    const phone = outlet?.phone || '9876543210';

    try {
      await createNudgeInDb({
        outlet_id: outletId,
        outlet_name: outletName,
        phone,
        product_id: productId,
        product_name: productName,
        date: asOfDate,
        status: 'sent',
      });

      await loadNudges();

      showToast(
        `WhatsApp reorder nudge logged for ${outletName} (${productName})! Store owner will see this in their incoming alerts.`,
        'success'
      );
    } catch (err) {
      console.error('Failed to log nudge:', err);
      showToast('Failed to record nudge. Check network connection.', 'info');
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Banner for Nudge / Import Activity */}
      {toastMessage && (
        <div
          id="distributor-toast-banner"
          className="p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-xs bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]"
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 text-[#64748B] hover:text-[#0F172A] rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Sub-Bar: Photo Import & Cadence Status */}
      <div className={`${CARD_STYLE} p-3 sm:px-4 flex items-center justify-between gap-3`}>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-[#64748B] font-medium">Predictions based on:</span>
          <span className="text-xs font-bold text-[#0F766E] bg-[#F0FDFA] px-2 py-0.5 rounded border border-[#99F6E4]/70">
            Each outlet's usual order gap
          </span>
        </div>

        <button
          id="tab-import-photo-quick-btn"
          type="button"
          onClick={() => setIsPhotoImportOpen(true)}
          className={`${BUTTON_STYLES.primary} text-xs py-1.5 px-3`}
          title="Upload invoice photo to extract orders using Gemini Vision"
        >
          <Camera className="w-3.5 h-3.5 mr-1.5" />
          <span>Import Invoice from Photo</span>
        </button>
      </div>

      {/* Screen 1: Today Screen */}
      {activeTab === 'today' && (
        <div key="today" className="animate-in fade-in slide-in-from-bottom-1 duration-200">
          <TodayTab
            predictions={predictions}
            outlets={outlets}
            products={products}
            isLoading={isLoading}
            asOfDate={asOfDate}
            onRefreshData={onRefreshData}
            onLogNudge={handleLogNudge}
          />
        </div>
      )}

      {/* Screen 2: Outlets Directory & Detail Screen */}
      {activeTab === 'outlets' && (
        <div key="outlets" className="animate-in fade-in slide-in-from-bottom-1 duration-200">
          <OutletsTab
            outlets={outlets}
            products={products}
            predictions={predictions}
            asOfDate={asOfDate}
            onRefreshData={onRefreshData}
            onLogNudge={handleLogNudge}
            onOpenPhotoImport={() => setIsPhotoImportOpen(true)}
          />
        </div>
      )}

      {/* Screen 3: Orders Chronological Log */}
      {activeTab === 'orders' && (
        <div key="orders" className="animate-in fade-in slide-in-from-bottom-1 duration-200">
          <OrdersTab
            orders={orders}
            outlets={outlets}
            products={products}
            asOfDate={asOfDate}
            onOpenPhotoImport={() => setIsPhotoImportOpen(true)}
          />
        </div>
      )}

      {/* Screen 4: Nudges Sent Today Log */}
      {activeTab === 'nudges' && (
        <div key="nudges" className="animate-in fade-in slide-in-from-bottom-1 duration-200">
          <NudgesTab
            nudges={nudges}
            asOfDate={asOfDate}
            outlets={outlets}
            products={products}
            onRefresh={loadNudges}
            onManualNudge={handleLogNudge}
          />
        </div>
      )}

      {/* Import Orders from Photo Modal */}
      <ImportFromPhotoModal
        isOpen={isPhotoImportOpen}
        onClose={() => setIsPhotoImportOpen(false)}
        outlets={outlets}
        products={products}
        asOfDate={asOfDate}
        onOrdersImported={async () => {
          await onRefreshData();
          await loadNudges();
          setActiveTab('orders');
          showToast('Orders imported and reorder predictions updated!', 'success');
        }}
      />
    </div>
  );
};
