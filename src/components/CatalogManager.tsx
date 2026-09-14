import React, { useState, useRef } from 'react';
import { Outlet, Product, Distributor } from '../types';
import {
  Store,
  Package,
  Plus,
  Upload,
  Copy,
  Check,
  FileSpreadsheet,
  AlertCircle,
  Tag,
  MapPin,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { addOutletManually, addProductManually, bulkImportCatalog, BulkImportPayload } from '../lib/firestoreService';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';

interface CatalogManagerProps {
  distributor: Distributor;
  outlets: Outlet[];
  products: Product[];
  onDataUpdated: () => void;
  onOpenBusinessSetup: () => void;
}

export const CatalogManager: React.FC<CatalogManagerProps> = ({
  distributor,
  outlets,
  products,
  onDataUpdated,
  onOpenBusinessSetup,
}) => {
  const [activeTab, setActiveTab] = useState<'outlets' | 'products'>('outlets');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Manual Add Outlet Form State
  const [showAddOutlet, setShowAddOutlet] = useState(false);
  const [newOutletName, setNewOutletName] = useState('');
  const [newOutletRoute, setNewOutletRoute] = useState(distributor.route || 'Ward Road');
  const [newOutletOwner, setNewOutletOwner] = useState('');
  const [newOutletPhone, setNewOutletPhone] = useState('');
  const [isSavingOutlet, setIsSavingOutlet] = useState(false);
  const [outletError, setOutletError] = useState<string | null>(null);

  // Manual Add Product Form State
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('case');
  const [newProductPrice, setNewProductPrice] = useState<number>(500);
  const [newProductMrp, setNewProductMrp] = useState<number>(625);
  const [newProductItems, setNewProductItems] = useState<number>(12);
  const [newProductCategory, setNewProductCategory] = useState('Packaged Goods');
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  // Bulk Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy invite code to clipboard
  const handleCopyInvite = () => {
    if (!distributor.invite_code) return;
    navigator.clipboard.writeText(distributor.invite_code);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  // Add Outlet
  const handleAddOutletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutletName.trim() || !newOutletRoute.trim()) {
      setOutletError('Please enter store name and delivery route.');
      return;
    }
    setIsSavingOutlet(true);
    setOutletError(null);
    try {
      await addOutletManually({
        distributor_id: distributor.id,
        name: newOutletName,
        route: newOutletRoute,
        owner: newOutletOwner,
        phone: newOutletPhone,
      });
      setNewOutletName('');
      setNewOutletOwner('');
      setNewOutletPhone('');
      setShowAddOutlet(false);
      onDataUpdated();
    } catch (err: any) {
      console.error('Failed to add outlet:', err);
      setOutletError(err?.message || 'Failed to add outlet. Please try again.');
    } finally {
      setIsSavingOutlet(false);
    }
  };

  // Add Product
  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      setProductError('Please enter a product name.');
      return;
    }
    if (newProductPrice <= 0) {
      setProductError('Price must be greater than 0.');
      return;
    }
    setIsSavingProduct(true);
    setProductError(null);
    try {
      await addProductManually({
        distributor_id: distributor.id,
        name: newProductName,
        unit: newProductUnit,
        wholesale_price: Number(newProductPrice),
        mrp: Number(newProductMrp || newProductPrice * 1.25),
        items_per_case: Number(newProductItems || 12),
        category: newProductCategory || 'General',
      });
      setNewProductName('');
      setShowAddProduct(false);
      onDataUpdated();
    } catch (err: any) {
      console.error('Failed to add product:', err);
      setProductError(err?.message || 'Failed to add product. Please try again.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Bulk File JSON Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Normalize format: can be { outlets: [...], products: [...] } or an array
        let payload: BulkImportPayload = {};

        if (Array.isArray(parsed)) {
          // If array of outlets or products
          if (parsed.length > 0 && ('route' in parsed[0] || 'owner' in parsed[0])) {
            payload.outlets = parsed;
          } else if (parsed.length > 0 && ('wholesale_price' in parsed[0] || 'unit' in parsed[0])) {
            payload.products = parsed;
          } else {
            throw new Error(
              'Unrecognized JSON array schema. Expecting objects with "route" (outlets) or "wholesale_price" (products).'
            );
          }
        } else if (typeof parsed === 'object' && parsed !== null) {
          payload = parsed;
        } else {
          throw new Error('Invalid JSON format.');
        }

        setIsImporting(true);
        setImportStatus(null);

        const result = await bulkImportCatalog(distributor.id, payload);
        setImportStatus({
          type: 'success',
          message: `Successfully imported ${result.outletsCount} outlets and ${result.productsCount} products into your catalog.`,
        });
        onDataUpdated();
      } catch (err: any) {
        console.error('Bulk import error:', err);
        setImportStatus({
          type: 'error',
          message: `Import failed: ${err?.message || 'Please check your JSON format.'}`,
        });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const inviteCodeDisplay = distributor.invite_code || `${distributor.id.substring(0, 4).toUpperCase()}-KIRANA`;

  return (
    <div className="space-y-6">
      {/* Top Banner: Agency Profile & Kirana Invite Code */}
      <div className={`${CARD_STYLE} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div className="flex items-start space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]/70 flex items-center justify-center shrink-0 shadow-xs">
            <Store className="w-6 h-6 text-[#0F766E]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">
                {distributor.agency_name || distributor.name || 'Your FMCG Agency'}
              </h2>
              <button
                type="button"
                id="edit-agency-details-btn"
                onClick={onOpenBusinessSetup}
                className="text-[11px] text-[#0F766E] hover:text-[#14B8A6] font-semibold underline underline-offset-2 cursor-pointer"
              >
                Edit Details
              </button>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Primary Route: <span className="font-semibold text-[#0F172A]">{distributor.route || 'Ward Road'}</span>
              {distributor.location && ` • ${distributor.location}`}
            </p>
          </div>
        </div>

        {/* Invite Code Box */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between sm:justify-start space-x-3 shrink-0">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              Retailer Invite Code
            </div>
            <div className="text-sm font-mono font-bold text-[#0F766E] tracking-wide">
              {inviteCodeDisplay}
            </div>
          </div>

          <button
            id="copy-invite-code-btn"
            type="button"
            onClick={handleCopyInvite}
            title="Copy code to share with kirana store owners"
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              copiedInvite
                ? 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]'
                : 'bg-white text-[#0F172A] border-[#E2E8F0] hover:bg-[#F8FAFC]'
            }`}
          >
            {copiedInvite ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Share Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Catalog Tabs & Bulk Import Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
        {/* Tabs */}
        <div className="flex items-center space-x-2">
          <button
            id="tab-outlets-btn"
            type="button"
            onClick={() => setActiveTab('outlets')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'outlets'
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Outlets ({outlets.length})</span>
          </button>

          <button
            id="tab-products-btn"
            type="button"
            onClick={() => setActiveTab('products')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'products'
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Products ({products.length})</span>
          </button>
        </div>

        {/* Action Controls: Manual Add + Bulk Import Button */}
        <div className="flex items-center space-x-2.5">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            id="bulk-import-input"
          />

          <button
            id="bulk-import-btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className={`${BUTTON_STYLES.secondary} text-xs py-2 px-3.5`}
          >
            <Upload className={`w-3.5 h-3.5 mr-1.5 text-[#0F766E] ${isImporting ? 'animate-bounce' : ''}`} />
            <span>{isImporting ? 'Importing...' : 'Bulk Import JSON'}</span>
          </button>

          {activeTab === 'outlets' ? (
            <button
              id="open-add-outlet-btn"
              type="button"
              onClick={() => setShowAddOutlet(prev => !prev)}
              className={`${BUTTON_STYLES.primary} text-xs py-2 px-3.5`}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Add Outlet</span>
            </button>
          ) : (
            <button
              id="open-add-product-btn"
              type="button"
              onClick={() => setShowAddProduct(prev => !prev)}
              className={`${BUTTON_STYLES.primary} text-xs py-2 px-3.5`}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Import Status Alert */}
      {importStatus && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            importStatus.type === 'success'
              ? 'bg-[#DCFCE7] border-[#BBF7D0] text-[#16A34A]'
              : 'bg-[#FEE2E2] border-[#FECACA] text-[#DC2626]'
          }`}
        >
          <div className="flex items-center space-x-2">
            {importStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
            )}
            <span>{importStatus.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportStatus(null)}
            className="text-[#64748B] hover:text-[#0F172A] font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Manual Add Outlet Card */}
      {showAddOutlet && activeTab === 'outlets' && (
        <div className={`${CARD_STYLE} p-5 bg-[#F8FAFC]`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center space-x-2">
              <Store className="w-4 h-4 text-[#0F766E]" />
              <span>Add New Retail Outlet</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddOutlet(false)}
              className="text-xs text-[#64748B] hover:text-[#0F172A] font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {outletError && (
            <div className="mb-3 p-3 text-xs bg-[#FEE2E2] border border-[#FECACA] rounded-xl text-[#DC2626] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
              <span>{outletError}</span>
            </div>
          )}

          <form onSubmit={handleAddOutletSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
                Store Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Balaji Super Mart"
                value={newOutletName}
                onChange={e => setNewOutletName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
                Delivery Route *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Ward Road"
                value={newOutletRoute}
                onChange={e => setNewOutletRoute(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
                Proprietor / Owner
              </label>
              <input
                type="text"
                placeholder="e.g., Suresh Mehta"
                value={newOutletOwner}
                onChange={e => setNewOutletOwner(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
                Phone Number
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="+91 98..."
                  value={newOutletPhone}
                  onChange={e => setNewOutletPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                />
                <button
                  type="submit"
                  disabled={isSavingOutlet}
                  className={`${BUTTON_STYLES.primary} text-xs py-2 px-4 shrink-0`}
                >
                  {isSavingOutlet ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Manual Add Product Card */}
      {showAddProduct && activeTab === 'products' && (
        <div className={`${CARD_STYLE} p-5 bg-[#F8FAFC]`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center space-x-2">
              <Package className="w-4 h-4 text-[#0F766E]" />
              <span>Add New Product SKU</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddProduct(false)}
              className="text-xs text-[#64748B] hover:text-[#0F172A] font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {productError && (
            <div className="mb-3 p-3 text-xs bg-[#FEE2E2] border border-[#FECACA] rounded-xl text-[#DC2626] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
              <span>{productError}</span>
            </div>
          )}

          <form onSubmit={handleAddProductSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
                Product Title / SKU *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Tata Tea Gold 500g"
                value={newProductName}
                onChange={e => setNewProductName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
                Wholesale Unit
              </label>
              <input
                type="text"
                placeholder="case / box / bag"
                value={newProductUnit}
                onChange={e => setNewProductUnit(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
                Wholesale Price (₹)
              </label>
              <input
                type="number"
                value={newProductPrice}
                onChange={e => setNewProductPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
                Action
              </label>
              <button
                type="submit"
                disabled={isSavingProduct}
                className={`${BUTTON_STYLES.primary} w-full py-2 text-xs`}
              >
                {isSavingProduct ? 'Saving...' : 'Save SKU'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 1: Outlets Table */}
      {activeTab === 'outlets' && (
        <div className={`${CARD_STYLE} overflow-hidden`}>
          <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
            <div className="text-xs font-bold text-[#0F172A]">
              Registered Retail Outlets on Route
            </div>
            <div className="text-xs text-[#64748B] font-medium">
              Total Outlets: <span className="font-bold text-[#0F172A]">{outlets.length}</span>
            </div>
          </div>

          {outlets.length === 0 ? (
            <div className="p-12 text-center text-[#64748B]">
              <Store className="w-8 h-8 mx-auto mb-2 text-[#64748B]/50" />
              <p className="text-sm font-medium text-[#0F172A]">No outlets registered yet.</p>
              <p className="text-xs text-[#64748B] mt-1">
                Add an outlet manually or click &ldquo;Bulk Import JSON&rdquo; above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3">Outlet ID</th>
                    <th className="px-4 py-3">Store Name</th>
                    <th className="px-4 py-3">Delivery Route</th>
                    <th className="px-4 py-3">Owner / Contact</th>
                    <th className="px-4 py-3">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
                  {outlets.map(outlet => (
                    <tr key={outlet.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#0F766E]">{outlet.id}</td>
                      <td className="px-4 py-3 font-semibold text-[#0F172A]">{outlet.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#F1F5F9] text-[#0F172A] text-[11px] font-medium border border-[#E2E8F0]">
                          <MapPin className="w-3 h-3 mr-1 text-[#64748B]" />
                          {outlet.route}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{outlet.owner || '—'}</td>
                      <td className="px-4 py-3 text-[#64748B] font-mono text-[11px]">{outlet.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Products Table */}
      {activeTab === 'products' && (
        <div className={`${CARD_STYLE} overflow-hidden`}>
          <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
            <div className="text-xs font-bold text-[#0F172A]">
              Wholesale SKU Catalog
            </div>
            <div className="text-xs text-[#64748B] font-medium">
              Total SKUs: <span className="font-bold text-[#0F172A]">{products.length}</span>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="p-12 text-center text-[#64748B]">
              <Package className="w-8 h-8 mx-auto mb-2 text-[#64748B]/50" />
              <p className="text-sm font-medium text-[#0F172A]">No products in catalog yet.</p>
              <p className="text-xs text-[#64748B] mt-1">
                Add your first SKU manually or click &ldquo;Bulk Import JSON&rdquo;.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3">SKU ID</th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Wholesale Rate</th>
                    <th className="px-4 py-3 text-right">Retail MRP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
                  {products.map(prod => (
                    <tr key={prod.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#0F766E]">{prod.id}</td>
                      <td className="px-4 py-3 font-semibold text-[#0F172A]">{prod.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                          {prod.category || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748B] capitalize">{prod.unit}</td>
                      <td className="px-4 py-3 font-mono font-bold text-[#0F172A] text-right">
                        ₹{prod.wholesale_price}
                      </td>
                      <td className="px-4 py-3 font-mono text-[#64748B] text-right">
                        ₹{prod.mrp || Math.round(prod.wholesale_price * 1.2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
