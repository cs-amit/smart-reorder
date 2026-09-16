import React, { useState, useRef } from 'react';
import {
  Building2,
  Store,
  Package,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Upload,
  Sparkles,
  MapPin,
  Phone,
  Tag,
  IndianRupee,
  Layers,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { Distributor, Outlet, Product } from '../types';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';
import { bulkImportCatalog, BulkImportPayload } from '../lib/firestoreService';
import { apiFetch } from '../lib/api';

interface FirstRunOnboardingProps {
  distributor: Distributor;
  onCompleted: (updatedDist: Distributor) => void;
}

export const FirstRunOnboarding: React.FC<FirstRunOnboardingProps> = ({
  distributor,
  onCompleted,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Step 1 State: Business details
  const [agencyName, setAgencyName] = useState(distributor.name || '');
  const [route, setRoute] = useState(distributor.route || '');

  // Step 2 State: First outlet
  const [outletName, setOutletName] = useState('');
  const [outletOwner, setOutletOwner] = useState('');
  const [outletPhone, setOutletPhone] = useState('');
  const [outletRoute, setOutletRoute] = useState(route || 'Main Market Route');

  // Step 3 State: First product
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('Beverages & Snacks');
  const [productUnit, setProductUnit] = useState('case');
  const [wholesalePrice, setWholesalePrice] = useState('520');
  const [mrp, setMrp] = useState('600');
  const [itemsPerCase, setItemsPerCase] = useState('24');

  // Completed items tracking
  const [savedOutlet, setSavedOutlet] = useState<Outlet | null>(null);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyName.trim() || !route.trim()) {
      setError('Please provide both your wholesale business name and primary delivery route.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/distributor/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...distributor,
          name: agencyName.trim(),
          route: route.trim(),
        }),
      }, distributor.id);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to update business profile');
      }
      setOutletRoute(route.trim());
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.message || 'Error saving details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletName.trim() || !outletPhone.trim()) {
      setError('Outlet name and contact phone number are required.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const newOutlet: Partial<Outlet> = {
        name: outletName.trim(),
        // Leave genuinely unset rather than falling back to the store's own
        // name — "Owner: Test Kirana Store" for a store called "Test Kirana
        // Store" reads as real (and wrong) data, not an empty field. Every
        // outlet card already renders the owner line conditionally.
        owner: outletOwner.trim() || undefined,
        phone: outletPhone.trim(),
        route: outletRoute.trim() || route,
      };

      const res = await apiFetch('/api/outlets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOutlet),
      }, distributor.id);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to add outlet');
      }
      setSavedOutlet(data.data);
      setCurrentStep(3);
    } catch (err: any) {
      setError(err.message || 'Error creating outlet');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError('Product name is required.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const newProduct: Partial<Product> = {
        name: productName.trim(),
        category: productCategory.trim() || 'FMCG Wholesale',
        unit: productUnit.trim() || 'case',
        wholesale_price: Number(wholesalePrice) || 500,
        mrp: Number(mrp) || 600,
        items_per_case: Number(itemsPerCase) || 24,
      };

      const res = await apiFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      }, distributor.id);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to add product');
      }

      // Mark onboarding as complete on distributor profile
      const distRes = await apiFetch('/api/distributor/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...distributor,
          name: agencyName.trim(),
          route: route.trim(),
          has_completed_onboarding: true,
        }),
      }, distributor.id);
      const distData = await distRes.json();
      onCompleted(distData.data || { ...distributor, name: agencyName.trim(), route: route.trim(), has_completed_onboarding: true });
    } catch (err: any) {
      setError(err.message || 'Error finalizing onboarding');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        setIsImporting(true);
        setError(null);
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let payload: BulkImportPayload = {};
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && ('route' in parsed[0] || 'owner' in parsed[0])) {
            payload.outlets = parsed;
          } else if (parsed.length > 0 && ('wholesale_price' in parsed[0] || 'unit' in parsed[0])) {
            payload.products = parsed;
          } else {
            throw new Error('Unrecognized JSON structure. Expecting outlets or products array.');
          }
        } else if (typeof parsed === 'object' && parsed !== null) {
          payload = parsed;
        }

        await bulkImportCatalog(distributor.id, payload);

        // Update onboarding status
        await apiFetch('/api/distributor/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...distributor,
            name: agencyName.trim() || distributor.name,
            route: route.trim() || distributor.route,
            has_completed_onboarding: true,
          }),
        }, distributor.id);

        const res = await apiFetch('/api/distributor', {}, distributor.id);
        const data = await res.json();
        onCompleted(data.data || { ...distributor, has_completed_onboarding: true });
      } catch (err: any) {
        setError(`Bulk import failed: ${err.message || 'Please check JSON file'}`);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8 font-sans text-[#0F172A] flex items-center justify-center">
      <div className="w-full max-w-2xl">
        {/* Brand & Title */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#0F766E] text-white flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Sparkles className="w-6 h-6 text-[#CCFBF1]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            Welcome to Smart Reorder
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1.5 max-w-md mx-auto">
            Set up your wholesale agency in 3 quick steps to start generating predictive reorder dates.
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-bold text-[#64748B] mb-2 px-1">
            <span className={currentStep >= 1 ? 'text-[#0F766E]' : ''}>1. Business & Route</span>
            <span className={currentStep >= 2 ? 'text-[#0F766E]' : ''}>2. First Kirana Outlet</span>
            <span className={currentStep >= 3 ? 'text-[#0F766E]' : ''}>3. First Product</span>
          </div>
          <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-[#0F766E] transition-all duration-300"
              style={{ width: currentStep === 1 ? '33.3%' : currentStep === 2 ? '66.6%' : '100%' }}
            />
          </div>
        </div>

        {/* Card Container */}
        <div className={`${CARD_STYLE} p-6 sm:p-8`}>
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Business Name & Route */}
          {currentStep === 1 && (
            <form onSubmit={handleStep1Submit} key="step1" className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-5">
              <div className="flex items-center space-x-3 pb-4 border-b border-[#E2E8F0]">
                <div className="w-10 h-10 rounded-lg bg-[#F0FDFA] border border-[#99F6E4] flex items-center justify-center text-[#0F766E]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Agency Business Details</h2>
                  <p className="text-xs text-[#64748B]">What is your wholesale agency called and which territory do you supply?</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                  Business / Agency Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="text"
                    required
                    value={agencyName}
                    onChange={e => setAgencyName(e.target.value)}
                    placeholder="e.g. Anand Distributors, Sri Krishna Agency"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                  Primary Delivery Route / Beat *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="text"
                    required
                    value={route}
                    onChange={e => setRoute(e.target.value)}
                    placeholder="e.g. Ward Road, Station Beat, North Bazaar"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>
                <span className="text-[11px] text-[#64748B] mt-1 block">
                  This route will be assigned by default to your kirana store visits.
                </span>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#0F766E] hover:text-[#14B8A6] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isImporting ? 'Importing...' : 'Have JSON? Bulk import catalog instead'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className={`${BUTTON_STYLES.primary} text-xs py-2.5 px-5 flex items-center space-x-2`}
                >
                  <span>Continue to Outlets</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Add First Outlet */}
          {currentStep === 2 && (
            <form onSubmit={handleStep2Submit} key="step2" className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-5">
              <div className="flex items-center space-x-3 pb-4 border-b border-[#E2E8F0]">
                <div className="w-10 h-10 rounded-lg bg-[#F0FDFA] border border-[#99F6E4] flex items-center justify-center text-[#0F766E]">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Add Your First Kirana Outlet</h2>
                  <p className="text-xs text-[#64748B]">Add a retail shop that buys regularly from your agency.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Outlet / Store Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={outletName}
                    onChange={e => setOutletName(e.target.value)}
                    placeholder="e.g. Lakshmi Kirana, Gupta General Store"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Owner / Contact Person
                  </label>
                  <input
                    type="text"
                    value={outletOwner}
                    onChange={e => setOutletOwner(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    WhatsApp Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type="tel"
                      required
                      value={outletPhone}
                      onChange={e => setOutletPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Delivery Route
                  </label>
                  <input
                    type="text"
                    value={outletRoute}
                    onChange={e => setOutletRoute(e.target.value)}
                    placeholder="e.g. Ward Road"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`${BUTTON_STYLES.secondary} text-xs py-2 px-3.5 flex items-center space-x-1`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer hidden sm:inline-flex items-center space-x-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isImporting ? 'Importing...' : 'Bulk Import JSON instead'}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`${BUTTON_STYLES.primary} text-xs py-2.5 px-5 flex items-center space-x-2`}
                  >
                    <span>Save & Add Product</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: Add First Product */}
          {currentStep === 3 && (
            <form onSubmit={handleStep3Submit} key="step3" className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-[#F0FDFA] border border-[#99F6E4] flex items-center justify-center text-[#0F766E]">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">Add Your First SKU / Product</h2>
                    <p className="text-xs text-[#64748B]">Add a core product you distribute to retail outlets.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer hidden sm:inline-flex items-center space-x-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isImporting ? 'Importing...' : 'Bulk Import JSON'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    placeholder="e.g. Parle-G 250g, Tata Tea Gold 500g"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Category
                  </label>
                  <input
                    type="text"
                    value={productCategory}
                    onChange={e => setProductCategory(e.target.value)}
                    placeholder="e.g. Biscuits, Tea, Edible Oil"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Wholesale Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={wholesalePrice}
                    onChange={e => setWholesalePrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    value={mrp}
                    onChange={e => setMrp(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={productUnit}
                    onChange={e => setProductUnit(e.target.value)}
                    placeholder="case / box"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className={`${BUTTON_STYLES.secondary} text-xs py-2 px-3.5 flex items-center space-x-1`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className={`${BUTTON_STYLES.primary} text-xs py-2.5 px-6 flex items-center space-x-2`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Setup & Enter Dashboard</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Hidden File Input for Bulk Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
        id="onboarding-bulk-import-input"
      />
    </div>
  );
};
