import React, { useState, useRef } from 'react';
import { Outlet, Product, CandidateOrderLine } from '../types';
import { SAMPLE_INVOICES, SampleInvoicePreset } from '../data/sampleInvoices';
import { saveImportedOrders } from '../lib/firestoreService';
import { apiFetch } from '../lib/api';
import {
  Camera,
  Upload,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  X,
  FileText,
  HelpCircle,
  ArrowRight,
  Store,
  Package,
  Calendar,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';

interface ImportFromPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  outlets: Outlet[];
  products: Product[];
  asOfDate: string;
  distributorId?: string;
  onOrdersImported: () => Promise<void>;
}

export const ImportFromPhotoModal: React.FC<ImportFromPhotoModalProps> = ({
  isOpen,
  onClose,
  outlets,
  products,
  asOfDate,
  distributorId,
  onOrdersImported,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string>('gemini-3.8-flash');
  const [fallbackUsed, setFallbackUsed] = useState<boolean>(false);

  // Candidate lines extracted by Gemini
  const [candidateLines, setCandidateLines] = useState<CandidateOrderLine[]>([]);
  const [hasExtracted, setHasExtracted] = useState<boolean>(false);

  // Saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetAll = () => {
    setSelectedImage(null);
    setImageFileName('');
    setCandidateLines([]);
    setHasExtracted(false);
    setExtractError(null);
    setSaveSuccessMessage(null);
    setIsExtracting(false);
    setIsSaving(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFileName(file.name);
    setImageMimeType(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedImage(result);
      processImageWithGemini(result, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (preset: SampleInvoicePreset) => {
    setSelectedImage(preset.dataUrl);
    setImageFileName(preset.title);
    setImageMimeType('image/svg+xml');
    processImageWithGemini(preset.dataUrl, 'image/svg+xml');
  };

  const processImageWithGemini = async (base64Img: string, mime: string) => {
    setIsExtracting(true);
    setExtractError(null);
    setSaveSuccessMessage(null);

    try {
      const res = await apiFetch('/api/gemini/extract-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Img,
          mimeType: mime,
          asOfDate,
        }),
      }, distributorId);

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to extract orders from image');
      }

      setCandidateLines(json.data || []);
      setModelUsed(json.model_used || 'gemini-3.8-flash');
      setFallbackUsed(Boolean(json.fallback_used));
      setHasExtracted(true);
    } catch (err: any) {
      console.error('OCR Extraction error:', err);
      setExtractError(err?.message || 'Error communicating with Gemini Vision');
    } finally {
      setIsExtracting(false);
    }
  };

  // Editable row updates
  const updateLineOutlet = (lineId: string, outletId: string) => {
    const foundOutlet = outlets.find(o => o.id === outletId);
    setCandidateLines(prev =>
      prev.map(line => {
        if (line.id !== lineId) return line;
        const hasProd = Boolean(line.matched_product_id);
        return {
          ...line,
          matched_outlet_id: outletId || null,
          matched_outlet_name: foundOutlet ? foundOutlet.name : null,
          status: outletId && hasProd ? 'matched' : 'manual_review_needed',
        };
      })
    );
  };

  const updateLineProduct = (lineId: string, productId: string) => {
    const foundProduct = products.find(p => p.id === productId);
    setCandidateLines(prev =>
      prev.map(line => {
        if (line.id !== lineId) return line;
        const hasOut = Boolean(line.matched_outlet_id);
        return {
          ...line,
          matched_product_id: productId || null,
          matched_product_name: foundProduct ? foundProduct.name : null,
          status: hasOut && productId ? 'matched' : 'manual_review_needed',
        };
      })
    );
  };

  const updateLineQuantity = (lineId: string, qty: number) => {
    setCandidateLines(prev =>
      prev.map(line => (line.id === lineId ? { ...line, quantity: Math.max(1, qty) } : line))
    );
  };

  const updateLineDate = (lineId: string, date: string) => {
    setCandidateLines(prev =>
      prev.map(line => (line.id === lineId ? { ...line, date } : line))
    );
  };

  const removeLine = (lineId: string) => {
    setCandidateLines(prev => prev.filter(line => line.id !== lineId));
  };

  const addNewBlankLine = () => {
    const newLine: CandidateOrderLine = {
      id: `cand_manual_${Date.now()}`,
      raw_outlet_name: '',
      raw_product_name: '',
      quantity: 5,
      date: asOfDate,
      matched_outlet_id: outlets[0]?.id || null,
      matched_outlet_name: outlets[0]?.name || null,
      matched_product_id: products[0]?.id || null,
      matched_product_name: products[0]?.name || null,
      status: outlets[0] && products[0] ? 'matched' : 'manual_review_needed',
      confidence: 1.0,
      raw_text: 'Manually added item',
    };
    setCandidateLines(prev => [...prev, newLine]);
  };

  // Validation before confirming
  const unconfiguredCount = candidateLines.filter(
    l => !l.matched_outlet_id || !l.matched_product_id
  ).length;

  const handleConfirmAndSave = async () => {
    if (candidateLines.length === 0) return;
    if (unconfiguredCount > 0) {
      alert('Please match all outlets and products before confirming.');
      return;
    }

    setIsSaving(true);
    setExtractError(null);

    const safetyTimer = setTimeout(() => {
      setIsSaving(false);
      setExtractError('Saving imported orders took too long. Please try again.');
    }, 5000);

    try {
      const ordersToSave = candidateLines.map(line => ({
        outlet_id: line.matched_outlet_id!,
        product_id: line.matched_product_id!,
        quantity: line.quantity,
        date: line.date || asOfDate,
        outlet_name: line.matched_outlet_name || undefined,
        product_name: line.matched_product_name || undefined,
      }));

      await saveImportedOrders(ordersToSave, distributorId);
      await onOrdersImported();

      clearTimeout(safetyTimer);
      setSaveSuccessMessage(`Added ${ordersToSave.length} orders successfully!`);
      setTimeout(() => {
        onClose();
        resetAll();
      }, 1500);
    } catch (err: any) {
      clearTimeout(safetyTimer);
      console.error('Failed to confirm and save imported orders:', err);
      setExtractError('Error saving orders: ' + (err?.message || 'Unknown error'));
    } finally {
      clearTimeout(safetyTimer);
      setIsSaving(false);
    }
  };

  return (
    <div
      id="import-from-photo-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        id="import-from-photo-modal-card"
        className="bg-white rounded-3xl border border-[#E2E8F0] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F766E] text-white flex items-center justify-center shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">
                  Import Orders from Photo
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4] flex items-center space-x-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>AI-Powered</span>
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Upload a paper invoice or handwritten order book page to extract structured line items
              </p>
            </div>
          </div>

          <button
            id="import-photo-modal-close-btn"
            type="button"
            onClick={() => {
              onClose();
              resetAll();
            }}
            className="w-8 h-8 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Step 1: Upload or Choose Sample if not yet extracted */}
          {!hasExtracted && !isExtracting && (
            <div className="space-y-6">
              {/* File Dropzone */}
              <div
                id="photo-import-dropzone"
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#E2E8F0] hover:border-[#14B8A6] bg-[#F8FAFC]/70 hover:bg-[#F0FDFA]/30 rounded-2xl p-8 text-center cursor-pointer transition-all group"
              >
                <input
                  ref={fileInputRef}
                  id="photo-import-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="w-14 h-14 rounded-2xl bg-white border border-[#E2E8F0] group-hover:border-[#14B8A6] group-hover:scale-105 shadow-xs mx-auto flex items-center justify-center text-[#64748B] group-hover:text-[#0F766E] transition-all mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1">
                  Upload or Snap Photo of Order Book / Invoice
                </h3>
                <p className="text-xs text-[#64748B] max-w-md mx-auto mb-3">
                  Accepts camera snapshots, PNG, JPG, or PDF photos of delivery challans, bills, and handwritten slips
                </p>
                <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#0F766E] text-white text-xs font-semibold shadow-xs group-hover:bg-[#0F766E] transition-colors">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Browse Device / Open Camera</span>
                </div>
              </div>

              {/* Sample Invoices for Instant Testing */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-[#64748B]" />
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                      Or Test with Sample Invoices
                    </h4>
                  </div>
                  <span className="text-[11px] text-[#64748B]">1-tap demo testing</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SAMPLE_INVOICES.map(preset => (
                    <button
                      key={preset.id}
                      id={`sample-preset-${preset.id}`}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="p-3.5 rounded-2xl border border-[#E2E8F0] bg-white hover:border-[#14B8A6] hover:bg-[#F0FDFA]/20 text-left transition-all group flex items-start space-x-3 shadow-xs"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] group-hover:bg-[#F0FDFA] flex items-center justify-center text-[#0F172A] group-hover:text-[#0F766E] shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-[#0F172A] group-hover:text-[#0F766E]">
                            {preset.title}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F1F5F9] group-hover:bg-[#F0FDFA] text-[#64748B] group-hover:text-[#0F766E] border border-[#E2E8F0]">
                            {preset.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] line-clamp-1">{preset.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Extraction in Progress */}
          {isExtracting && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-3xl bg-[#F0FDFA] text-[#0F766E] flex items-center justify-center animate-pulse">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div className="absolute inset-0 rounded-3xl border-2 border-[#14B8A6] animate-ping opacity-25" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Reading your photo...
                </h3>
                <p className="text-xs text-[#64748B] max-w-md">
                  Picking out shop names, products, quantities, and dates from the invoice
                </p>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-[#0F766E] font-semibold bg-[#F0FDFA] px-3 py-1.5 rounded-full border border-[#99F6E4]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0F766E]" />
                <span>This takes a few seconds...</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {extractError && (
            <div className="p-4 rounded-2xl bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
              <div className="flex-1">
                <p className="font-bold">Extraction Failed</p>
                <p>{extractError}</p>
                <button
                  type="button"
                  onClick={resetAll}
                  className="mt-2 px-3 py-1 bg-[#FEE2E2] hover:bg-[#FECACA] text-[#7F1D1D] rounded-lg font-semibold"
                >
                  Try Another Photo
                </button>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {saveSuccessMessage && (
            <div className="p-4 rounded-2xl bg-[#F0FDFA] border border-[#99F6E4] text-[#0F766E] text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-[#14B8A6] shrink-0" />
              <div className="font-bold">{saveSuccessMessage}</div>
            </div>
          )}

          {/* Step 3: Extracted Lines Review Table */}
          {hasExtracted && (
            <div className="space-y-4">
              {/* Review summary header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-[#0F172A]">
                      Found {candidateLines.length} Orders
                    </span>
                    {unconfiguredCount === 0 ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4] flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-[#14B8A6]" />
                        <span>All {candidateLines.length} Matched</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 text-[#D97706]" />
                        <span>{unconfiguredCount} Need Your Input</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    Check each line below and fix anything wrong before saving
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={addNewBlankLine}
                    className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#0F172A] text-xs font-bold flex items-center space-x-1 transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Line</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#64748B] text-xs font-medium flex items-center space-x-1 transition-colors shadow-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Re-upload</span>
                  </button>
                </div>
              </div>

              {/* Photo Thumbnail + Zoom Drawer */}
              {selectedImage && (
                <div className="p-3 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <img
                      src={selectedImage}
                      alt="Uploaded Invoice"
                      className="w-12 h-12 rounded-xl object-cover border border-[#E2E8F0] bg-white shadow-2xs"
                    />
                    <div>
                      <span className="font-bold text-[#0F172A]">
                        {imageFileName || 'Uploaded Invoice Photo'}
                      </span>
                      <p className="text-[11px] text-[#64748B]">
                        Processed via {modelUsed} {fallbackUsed && '(preview demo model)'}
                      </p>
                    </div>
                  </div>
                  <a
                    href={selectedImage}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-[#0F766E] hover:text-[#0F766E] bg-[#F0FDFA] px-2.5 py-1 rounded-lg border border-[#99F6E4]"
                  >
                    Inspect Full Image
                  </a>
                </div>
              )}

              {/* Candidate Lines Editable Table */}
              <div className="border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[45vh]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F1F5F9]/90 sticky top-0 z-10 border-b border-[#E2E8F0] text-[#64748B] text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-8">#</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Outlet / Buyer</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Product / SKU</th>
                        <th className="py-2.5 px-3 w-28">Quantity</th>
                        <th className="py-2.5 px-3 w-36">Date</th>
                        <th className="py-2.5 px-3 w-32">Status</th>
                        <th className="py-2.5 px-3 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] bg-white">
                      {candidateLines.map((line, idx) => {
                        const isOutletMatched = Boolean(line.matched_outlet_id);
                        const isProductMatched = Boolean(line.matched_product_id);
                        const isRowMatched = isOutletMatched && isProductMatched;

                        return (
                          <tr
                            key={line.id}
                            className={`hover:bg-[#F8FAFC]/70 transition-colors ${
                              !isRowMatched ? 'bg-[#FEF3C7]/40' : ''
                            }`}
                          >
                            {/* Row Index */}
                            <td className="py-2.5 px-3 text-[#64748B] font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            {/* Outlet Selector */}
                            <td className="py-2.5 px-3">
                              <div className="space-y-1">
                                <select
                                  id={`line-outlet-select-${idx}`}
                                  value={line.matched_outlet_id || ''}
                                  onChange={e => updateLineOutlet(line.id, e.target.value)}
                                  className={`w-full rounded-xl px-2.5 py-1.5 text-xs border font-medium focus:outline-none focus:ring-2 ${
                                    !isOutletMatched
                                      ? 'border-[#D97706] bg-[#FEF3C7]/80 text-[#D97706] focus:ring-[#D97706]/20'
                                      : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] focus:ring-[#0F766E]/20'
                                  }`}
                                >
                                  <option value="">-- Select Retail Outlet --</option>
                                  {outlets.map(o => (
                                    <option key={o.id} value={o.id}>
                                      {o.name} ({o.route})
                                    </option>
                                  ))}
                                </select>
                                {line.raw_outlet_name && line.raw_outlet_name !== line.matched_outlet_name && (
                                  <div className="text-[10px] text-[#64748B] flex items-center space-x-1">
                                    <span>OCR text:</span>
                                    <span className="italic font-medium text-[#64748B]">
                                      "{line.raw_outlet_name}"
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Product Selector */}
                            <td className="py-2.5 px-3">
                              <div className="space-y-1">
                                <select
                                  id={`line-product-select-${idx}`}
                                  value={line.matched_product_id || ''}
                                  onChange={e => updateLineProduct(line.id, e.target.value)}
                                  className={`w-full rounded-xl px-2.5 py-1.5 text-xs border font-medium focus:outline-none focus:ring-2 ${
                                    !isProductMatched
                                      ? 'border-[#D97706] bg-[#FEF3C7]/80 text-[#D97706] focus:ring-[#D97706]/20'
                                      : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] focus:ring-[#0F766E]/20'
                                  }`}
                                >
                                  <option value="">-- Select Catalog Product --</option>
                                  {products.map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} (₹{p.wholesale_price}/{p.unit})
                                    </option>
                                  ))}
                                </select>
                                {line.raw_product_name && line.raw_product_name !== line.matched_product_name && (
                                  <div className="text-[10px] text-[#64748B] flex items-center space-x-1">
                                    <span>OCR text:</span>
                                    <span className="italic font-medium text-[#64748B]">
                                      "{line.raw_product_name}"
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Quantity Input */}
                            <td className="py-2.5 px-3">
                              <input
                                id={`line-quantity-input-${idx}`}
                                type="number"
                                min={1}
                                value={line.quantity}
                                onChange={e =>
                                  updateLineQuantity(line.id, parseInt(e.target.value) || 1)
                                }
                                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] font-bold focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                              />
                            </td>

                            {/* Date Input */}
                            <td className="py-2.5 px-3">
                              <input
                                id={`line-date-input-${idx}`}
                                type="date"
                                value={line.date}
                                onChange={e => updateLineDate(line.id, e.target.value)}
                                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                              />
                            </td>

                            {/* Status Chip */}
                            <td className="py-2.5 px-3">
                              {isRowMatched ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]">
                                  <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-[#14B8A6]" />
                                  Matched
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                                  <AlertCircle className="w-2.5 h-2.5 mr-1 text-[#D97706]" />
                                  Select {!isOutletMatched ? 'outlet' : 'product'}
                                </span>
                              )}
                            </td>

                            {/* Delete Action */}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                id={`line-remove-btn-${idx}`}
                                type="button"
                                title="Remove row"
                                onClick={() => removeLine(line.id)}
                                className="p-1 rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {candidateLines.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[#64748B] text-xs">
                            No candidate lines remaining. Click "+ Add Line" to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Warning note if items need matching */}
              {unconfiguredCount > 0 && (
                <div className="p-3 bg-[#FEF3C7] rounded-xl border border-[#FDE68A] text-[#D97706] text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
                  <span>
                    <strong>{unconfiguredCount} line(s)</strong> require manual outlet or product selection before confirming.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <button
            id="photo-modal-cancel-btn"
            type="button"
            onClick={() => {
              onClose();
              resetAll();
            }}
            className="px-4 py-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-bold transition-colors shadow-2xs"
          >
            Cancel
          </button>

          {hasExtracted && (
            <button
              id="photo-modal-confirm-btn"
              type="button"
              disabled={isSaving || candidateLines.length === 0 || unconfiguredCount > 0}
              onClick={handleConfirmAndSave}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all shadow-xs ${
                unconfiguredCount > 0 || candidateLines.length === 0
                  ? 'bg-[#E2E8F0] text-[#64748B] cursor-not-allowed'
                  : 'bg-[#0F766E] hover:bg-[#0F766E] text-white shadow-[#0F766E]/20'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Writing Real Orders...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Confirm & Save {candidateLines.length} Order{candidateLines.length !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
