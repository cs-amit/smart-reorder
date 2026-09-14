import React, { useState } from 'react';
import { Distributor, Outlet, Retailer } from '../types';
import { joinDistributorByInviteCode, JoinDistributorResult } from '../lib/firestoreService';
import {
  Store,
  KeyRound,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';

interface RetailerJoinScreenProps {
  uid: string;
  activeDistributor: Distributor | null;
  onJoined: (result: JoinDistributorResult) => void;
}

export const RetailerJoinScreen: React.FC<RetailerJoinScreenProps> = ({
  uid,
  activeDistributor,
  onJoined,
}) => {
  const [inviteCode, setInviteCode] = useState<string>(activeDistributor?.invite_code || '');
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError("Please enter your distributor's invite code.");
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name or store name.');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Failsafe timer
    const safetyTimer = setTimeout(() => {
      setIsSubmitting(false);
      setError('Connection took longer than expected. Please check your invite code and try again.');
    }, 5000);

    try {
      const result = await joinDistributorByInviteCode({
        code: inviteCode.trim(),
        name: name.trim(),
        phone: phone.trim(),
        uid,
      });

      clearTimeout(safetyTimer);
      onJoined(result);
    } catch (err: any) {
      clearTimeout(safetyTimer);
      console.error('Join failed:', err);
      setError(err?.message || 'Failed to join distributor. Please verify the invite code.');
    } finally {
      clearTimeout(safetyTimer);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-6 sm:py-10">
      <div className={`${CARD_STYLE} overflow-hidden`}>
        {/* Header Banner */}
        <div className="bg-[#0F766E] px-6 py-7 text-white">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Store className="w-5 h-5 text-[#CCFBF1]" />
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#99F6E4]">
                For Retailers
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Connect to Your Distributor
              </h2>
            </div>
          </div>
          <p className="text-xs text-[#CCFBF1] leading-relaxed mt-1">
            Ask your distributor for their invite code, then enter it below to link your store.
          </p>
        </div>

        {/* Distributor Hint Banner if one exists */}
        {activeDistributor && (
          <div className="bg-[#F0FDFA] border-b border-[#99F6E4]/70 px-6 py-3 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-[#0F766E]">
              <Building2 className="w-4 h-4 text-[#0F766E] shrink-0" />
              <span>
                Distributor on this route: <strong className="text-[#0F172A]">{activeDistributor.name}</strong>
              </span>
            </div>
            {activeDistributor.invite_code && (
              <button
                type="button"
                onClick={() => setInviteCode(activeDistributor.invite_code || '')}
                className="text-[#0F766E] hover:text-[#14B8A6] font-bold font-mono underline cursor-pointer"
              >
                Use Code ({activeDistributor.invite_code})
              </button>
            )}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Connection Error</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Field: Invite Code */}
          <div>
            <label
              htmlFor="retailer-invite-code"
              className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2"
            >
              Distributor Invite Code <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="retailer-invite-code"
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. FMCG-8392"
                className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#0F172A] font-mono font-bold tracking-wider text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-all"
                required
              />
            </div>
            <p className="text-[11px] text-[#64748B] mt-1.5">
              Get this code from your distributor.
            </p>
          </div>

          {/* Field: Retailer / Store Name */}
          <div>
            <label
              htmlFor="retailer-store-name"
              className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2"
            >
              Your Name or Store Name <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <User className="w-4 h-4" />
              </div>
              <input
                id="retailer-store-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Ramesh Gupta or Ramesh Kirana"
                className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#0F172A] text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-all"
                required
              />
            </div>
          </div>

          {/* Field: Phone Number */}
          <div>
            <label
              htmlFor="retailer-phone"
              className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2"
            >
              Phone Number <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="retailer-phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98220 11244"
                className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#0F172A] font-mono text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-all"
                required
              />
            </div>
            <p className="text-[11px] text-[#64748B] mt-1.5">
              If your phone matches an existing route outlet, you will be linked automatically without duplicate records.
            </p>
          </div>

          {/* Submit Button */}
          <button
            id="retailer-join-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className={`${BUTTON_STYLES.primary} w-full py-3 text-sm flex items-center justify-center space-x-2`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <span>Connect</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
