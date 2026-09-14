import React, { useState, useEffect } from 'react';
import { Distributor } from '../types';
import { Building2, MapPin, Phone, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { BUTTON_STYLES } from '../lib/theme';

interface DistributorSetupModalProps {
  isOpen: boolean;
  onClose?: () => void;
  uid: string;
  initialDistributor?: Distributor | null;
  onSaved: (distributor: Distributor) => void;
}

export const DistributorSetupModal: React.FC<DistributorSetupModalProps> = ({
  isOpen,
  onClose,
  uid,
  initialDistributor,
  onSaved,
}) => {
  const [businessName, setBusinessName] = useState(
    initialDistributor?.name || ''
  );
  const [routeArea, setRouteArea] = useState(
    initialDistributor?.route || ''
  );
  const [phone, setPhone] = useState(
    initialDistributor?.phone || ''
  );
  const [location, setLocation] = useState(
    initialDistributor?.location || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // The distributor record loads asynchronously after this modal has already
  // mounted, so refresh the form fields whenever it becomes available or the
  // modal is reopened — otherwise the fields stay stuck on their initial (empty) values.
  useEffect(() => {
    if (isOpen) {
      setBusinessName(initialDistributor?.name || '');
      setRouteArea(initialDistributor?.route || '');
      setPhone(initialDistributor?.phone || '');
      setLocation(initialDistributor?.location || '');
    }
  }, [isOpen, initialDistributor]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !routeArea.trim()) {
      setErrorMsg('Please enter both your business name and delivery area.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    // Failsafe timer to guarantee the button never spins indefinitely
    const safetyTimer = setTimeout(() => {
      setIsSubmitting(false);
      setErrorMsg('This is taking longer than expected. Please check your connection and try again.');
    }, 5000);

    try {
      // Dynamic import of Firestore service to save to Firestore and sync
      const { saveDistributorBusiness } = await import('../lib/firestoreService');
      const saved = await saveDistributorBusiness({
        uid,
        name: businessName,
        route: routeArea,
        phone,
        location: location || `${routeArea} Commercial Hub`,
      });

      clearTimeout(safetyTimer);
      onSaved(saved);
      if (onClose) onClose();
    } catch (err: any) {
      clearTimeout(safetyTimer);
      console.error('Failed to save distributor:', err);
      setErrorMsg(err.message || 'Could not save your business details. Please try again.');
    } finally {
      clearTimeout(safetyTimer);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-[#0F766E] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#CCFBF1]" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Your Business Details</h2>
              <p className="text-xs text-[#CCFBF1] font-medium">
                This is what your retailers will see
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div
              id="distributor-setup-error-banner"
              className="p-3.5 text-xs bg-[#FEE2E2] border border-[#FECACA] rounded-xl text-[#DC2626] flex items-start space-x-2.5"
            >
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Couldn&apos;t save</strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Business Name */}
          <div>
            <label
              htmlFor="dist-business-name"
              className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1"
            >
              Business Name <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="dist-business-name"
                type="text"
                required
                placeholder="e.g., Anand Distributors, Ward Road"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              The name retailers will see when they connect with you.
            </p>
          </div>

          {/* Route / Area Name */}
          <div>
            <label
              htmlFor="dist-route-area"
              className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1"
            >
              Delivery Area / Route <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="dist-route-area"
                type="text"
                required
                placeholder="e.g., Ward Road / Station Road"
                value={routeArea}
                onChange={e => setRouteArea(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              The area your delivery van covers.
            </p>
          </div>

          {/* Contact Phone & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="dist-phone"
                className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1"
              >
                Contact Phone
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="dist-phone"
                  type="text"
                  placeholder="+91 98201 45892"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="dist-location"
                className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1"
              >
                Shop / Warehouse Address
              </label>
              <input
                id="dist-location"
                type="text"
                placeholder="Shop #14, Commercial Complex"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>
          </div>

          {/* Invite Code Notice */}
          <div className="p-3 bg-[#F0FDFA] rounded-xl border border-[#99F6E4] text-xs text-[#0F766E] flex items-start space-x-2">
            <Sparkles className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Your retailer code:</span> We&apos;ll generate a short code
              automatically so your retailers can connect to you with it.
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end space-x-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] rounded-xl hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              id="submit-distributor-setup-btn"
              type="submit"
              disabled={isSubmitting}
              className={`${BUTTON_STYLES.primary} text-xs py-2.5 px-5`}
            >
              <span>{isSubmitting ? 'Saving...' : 'Save & Continue'}</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
