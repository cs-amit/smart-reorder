import React from 'react';
import {
  Sparkles,
  Truck,
  Store,
  ArrowRight,
  TrendingDown,
  Clock,
  Send,
  CalendarCheck,
  CheckCircle2,
  ShieldCheck,
  Zap,
  BarChart3,
  PhoneCall,
  UserCheck,
} from 'lucide-react';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';
import { UserRole } from '../types';

interface LandingPageProps {
  onSelectRoleForSignUp: (role: UserRole) => void;
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  onViewLiveDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectRoleForSignUp,
  onOpenSignIn,
  onOpenSignUp,
  onViewLiveDemo,
}) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#CCFBF1] selection:text-[#0F766E]">
      {/* 1. Header with Logo and Log In / Sign Up buttons */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#0F766E] flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-5 h-5 text-[#CCFBF1]" />
              </div>
              <div>
                <span className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A]">
                  Smart Reorder
                </span>
                <span className="hidden sm:inline-block ml-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#0F766E] bg-[#F0FDFA] px-2 py-0.5 rounded-full border border-[#99F6E4]/70">
                  For Distributors & Retailers
                </span>
              </div>
            </div>

            {/* Quick Navigation & Actions */}
            <div className="flex items-center space-x-3">
              <nav className="hidden md:flex items-center space-x-6 mr-4 text-sm font-medium text-[#64748B]">
                <a href="#how-it-works" className="hover:text-[#0F766E] transition-colors">
                  How It Works
                </a>
                <a href="#economics" className="hover:text-[#0F766E] transition-colors">
                  Unit Economics
                </a>
                <a href="#network" className="hover:text-[#0F766E] transition-colors">
                  Network Benefits
                </a>
              </nav>

              <button
                id="landing-header-demo-btn"
                type="button"
                onClick={onViewLiveDemo}
                className="hidden sm:inline-flex items-center space-x-1.5 text-xs font-bold text-[#0F766E] hover:text-[#14B8A6] bg-[#F0FDFA] hover:bg-[#CCFBF1] px-3.5 py-2 rounded-xl border border-[#99F6E4] transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>View live demo</span>
              </button>

              <button
                id="landing-header-login-btn"
                type="button"
                onClick={onOpenSignIn}
                className={BUTTON_STYLES.secondary}
              >
                Log In
              </button>

              <button
                id="landing-header-signup-btn"
                type="button"
                onClick={onOpenSignUp}
                className={BUTTON_STYLES.primary}
              >
                <span>Sign Up</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 overflow-hidden border-b border-[#E2E8F0] bg-gradient-to-b from-[#F0FDFA]/60 via-white to-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            {/* Tagline */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#F0FDFA] border border-[#99F6E4] text-xs font-semibold text-[#0F766E] mb-6">
              <Sparkles className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Built for local distributors and kirana stores</span>
            </div>

            {/* One-sentence core statement */}
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#0F172A] leading-tight sm:leading-[1.18]">
              Know exactly which shop needs a reorder — before they run out.
            </h1>

            <p className="mt-6 text-base sm:text-lg text-[#64748B] max-w-2xl mx-auto leading-relaxed">
              Smart Reorder learns each shop's ordering pattern and tells you who's due today —
              so no shop gets skipped and no salesman visit goes to waste.
            </p>

            {/* Two Clear Primary CTAs */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
              <button
                id="cta-distributor-btn"
                type="button"
                onClick={() => onSelectRoleForSignUp('distributor')}
                className="group p-5 rounded-xl bg-[#0F766E] hover:bg-[#14B8A6] text-white text-left transition-all shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center text-white">
                    <Truck className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-1.5">
                    <span>I'm a Distributor</span>
                  </h3>
                  <p className="text-xs text-white/80 mt-1 leading-relaxed">
                    Forecast store reorder dates, send 1-tap WhatsApp nudges, and organize routes.
                  </p>
                </div>
              </button>

              <button
                id="cta-retailer-btn"
                type="button"
                onClick={() => onSelectRoleForSignUp('retailer')}
                className="group p-5 rounded-xl bg-white hover:bg-[#F0FDFA] border-2 border-[#0F766E] text-left transition-all shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#F0FDFA] border border-[#99F6E4] flex items-center justify-center text-[#0F766E]">
                    <Store className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#0F766E] group-hover:translate-x-1 transition-transform" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] flex items-center space-x-1.5">
                    <span>I'm a Retailer</span>
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    Link with your distributor, restock in 1 tap before stockouts, and pay via UPI.
                  </p>
                </div>
              </button>
            </div>

            {/* Quick Demo Login Hint */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-[#64748B]">
              <div className="flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4 text-[#0F766E]" />
                <span>Evaluating the platform?</span>
              </div>
              <button
                id="hero-view-live-demo-btn"
                type="button"
                onClick={onViewLiveDemo}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-[#0F766E] font-bold hover:bg-[#CCFBF1] transition-colors cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>View live demo (Anand Distributors)</span>
              </button>
              <span className="hidden sm:inline text-[#CBD5E1]">•</span>
              <button
                type="button"
                onClick={onOpenSignIn}
                className="text-[#0F766E] font-semibold hover:underline cursor-pointer"
              >
                Sign in with existing credentials
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. "How it works" section — exactly three steps */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-white border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] bg-[#F0FDFA] px-3 py-1 rounded-full border border-[#99F6E4]/70">
              How It Works
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
              Three Simple Steps
            </h2>
            <p className="mt-3 text-base text-[#64748B]">
              A simple loop that keeps distributors and shop owners in sync.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className={`${CARD_STYLE} p-6 sm:p-8 flex flex-col relative`}>
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] flex items-center justify-center text-[#0F766E]">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className="text-2xl font-mono font-bold text-[#E2E8F0]">01</span>
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-2">
                Past orders come in
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Every order you already record — on paper, WhatsApp, or in the app — teaches Smart Reorder how often each shop buys each product.
              </p>
              <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center space-x-2 text-xs text-[#0F766E] font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>No spreadsheets, no extra data entry</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className={`${CARD_STYLE} p-6 sm:p-8 flex flex-col relative`}>
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] flex items-center justify-center text-[#0F766E]">
                  <Clock className="w-6 h-6" />
                </div>
                <span className="text-2xl font-mono font-bold text-[#E2E8F0]">02</span>
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-2">
                We predict who's due
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Smart Reorder works out when each shop is likely to run low on each product, and tells you exactly why — no black box.
              </p>
              <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center space-x-2 text-xs text-[#0F766E] font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>Catch shops before they run out and call someone else</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className={`${CARD_STYLE} p-6 sm:p-8 flex flex-col relative`}>
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] flex items-center justify-center text-[#0F766E]">
                  <Send className="w-6 h-6" />
                </div>
                <span className="text-2xl font-mono font-bold text-[#E2E8F0]">03</span>
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-2">
                Both sides get notified
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                You send a one-tap reminder, the shop gets a WhatsApp-style message with the order already filled in, and confirms it in a tap.
              </p>
              <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center space-x-2 text-xs text-[#0F766E] font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>Orders come in without a single sales visit</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Numbers / Business Case Section */}
      <section id="economics" className="py-16 sm:py-24 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] bg-[#F0FDFA] px-3 py-1 rounded-full border border-[#99F6E4]/70">
              The Cost of a Visit
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
              Why Small Shops Get Skipped
            </h2>
            <p className="mt-3 text-base text-[#64748B]">
              A salesman visit costs money whether or not the shop orders anything. Here's what changes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch max-w-5xl mx-auto">
            {/* Traditional Model Card */}
            <div className="bg-white rounded-xl border-2 border-[#FECACA] p-6 sm:p-8 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[#FEE2E2]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#DC2626]">
                    Without Smart Reorder
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEE2E2] text-[#DC2626]">
                    Costly & Easy to Miss
                  </span>
                </div>

                <div className="mt-6">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl sm:text-5xl font-extrabold text-[#DC2626] font-mono">
                      ₹30–40
                    </span>
                    <span className="text-sm font-semibold text-[#64748B]">
                      per kirana visit
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#64748B]">
                    Fuel, motorcycle wear, salesman salary, physical logbooks, and unproductive visits when the store still has stock.
                  </p>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-[#0F172A]">
                  <li className="flex items-start space-x-2.5">
                    <span className="text-[#DC2626] font-bold">✕</span>
                    <span className="text-[#64748B]">Salesman visits only once every 7–10 days on fixed beats</span>
                  </li>
                  <li className="flex items-start space-x-2.5">
                    <span className="text-[#DC2626] font-bold">✕</span>
                    <span className="text-[#64748B]">Retailer runs out on day 4 and orders from an opportunistic van</span>
                  </li>
                  <li className="flex items-start space-x-2.5">
                    <span className="text-[#DC2626] font-bold">✕</span>
                    <span className="text-[#64748B]">Manual pencil-and-paper order slips lead to mismatch and returns</span>
                  </li>
                  <li className="flex items-start space-x-2.5">
                    <span className="text-[#DC2626] font-bold">✕</span>
                    <span className="text-[#64748B]">Cash collection delays and outstanding credit risk</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
                Average cost per route: <strong className="text-[#0F172A]">₹18,000–25,000 / month</strong>
              </div>
            </div>

            {/* Smart Reorder Model Card */}
            <div className="bg-white rounded-xl border-2 border-[#0F766E] p-6 sm:p-8 shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#0F766E] text-white px-4 py-1 rounded-bl-xl text-xs font-bold uppercase tracking-wider">
                97% Cost Reduction
              </div>

              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[#CCFBF1]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                    With Smart Reorder
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#16A34A]">
                    Automatic
                  </span>
                </div>

                <div className="mt-6">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl sm:text-5xl font-extrabold text-[#0F766E] font-mono">
                      &lt; ₹1
                    </span>
                    <span className="text-sm font-semibold text-[#64748B]">
                      per reminder sent
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#64748B]">
                    A message that goes out on its own the moment a shop is likely to be running low.
                  </p>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-[#0F172A]">
                  <li className="flex items-start space-x-2.5">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
                    <span>Reminders go out right when a shop is likely running low</span>
                  </li>
                  <li className="flex items-start space-x-2.5">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
                    <span>Shop owners restock in one tap, right from the message</span>
                  </li>
                  <li className="flex items-start space-x-2.5">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
                    <span>Your salesmen spend more time getting new shops, not just visiting old ones</span>
                  </li>
                  <li className="flex items-start space-x-2.5">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
                    <span>UPI-style payment confirmation speeds up collections</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-[#CCFBF1] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0F766E]">Saves roughly ₹35 per shop, every visit</span>
                <span className="font-bold text-[#16A34A] bg-[#DCFCE7] px-2 py-0.5 rounded">Low Cost</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Network Benefits Callout */}
      <section id="network" className="py-14 sm:py-20 bg-white border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto bg-[#F0FDFA] rounded-2xl border border-[#99F6E4] p-8 sm:p-12 text-center">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              Ready to never miss a reorder again?
            </h3>
            <p className="mt-3 text-sm sm:text-base text-[#64748B] max-w-xl mx-auto">
              Set up takes a few minutes — free to try.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onSelectRoleForSignUp('distributor')}
                className={BUTTON_STYLES.primary}
              >
                <Truck className="w-4 h-4 mr-2" />
                <span>Get Started as Distributor</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectRoleForSignUp('retailer')}
                className={BUTTON_STYLES.secondary}
              >
                <Store className="w-4 h-4 mr-2 text-[#0F766E]" />
                <span>Get Started as Retailer</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="bg-white py-8 sm:py-12 text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-8 border-b border-[#E2E8F0]">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-[#0F766E] flex items-center justify-center text-white">
                <Sparkles className="w-4 h-4 text-[#CCFBF1]" />
              </div>
              <span className="font-bold text-[#0F172A] text-sm">Smart Reorder</span>
              <span className="text-[#CBD5E1]">•</span>
              <span>Smart reordering for distributors and shops</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs">
              <span>WhatsApp-style reminders</span>
              <span className="text-[#CBD5E1]">•</span>
              <span>UPI-style payments</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#64748B]">
            <p>© {new Date().getFullYear()} Smart Reorder. All rights reserved.</p>
            <p>Built for local distributors and kirana stores across India.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
