import React, { useState } from 'react';
import {
  Truck,
  Store,
  Lock,
  Mail,
  User,
  ArrowRight,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { UserRole, AppUser } from '../types';
import { loginUser, registerUser, resetPassword } from '../lib/authService';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';

interface AuthScreenProps {
  onAuthenticated: (user: AppUser) => void;
  initialMode?: 'signin' | 'signup';
  initialRole?: UserRole;
  onBackToHome?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  initialMode = 'signin',
  initialRole = 'distributor',
  onBackToHome,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        const result = await loginUser(email, password);
        onAuthenticated(result.user);
      } else {
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setIsSubmitting(false);
          return;
        }
        const result = await registerUser({
          email,
          password,
          role,
          name: name.trim() || undefined,
        });
        onAuthenticated(result.user);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email address above first, then tap "Forgot password?".');
      return;
    }
    setError(null);
    setIsSendingReset(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-[#CCFBF1] selection:text-[#0F766E]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            className="mb-4 inline-flex items-center space-x-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F766E] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Homepage</span>
          </button>
        )}

        {/* Brand Icon & Name */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-[#0F766E] flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-6 h-6 text-[#CCFBF1]" />
          </div>
        </div>
        <h2 className="mt-3 text-center text-2xl font-bold tracking-tight text-[#0F172A]">
          Smart Reorder
        </h2>
        <p className="mt-1 text-center text-xs text-[#64748B] max-w-sm mx-auto">
          Smart reordering for distributors and their retailers
        </p>

        {/* Tab Switcher */}
        <div className="mt-6 flex bg-[#F1F5F9] p-1 rounded-xl border border-[#E2E8F0]">
          <button
            type="button"
            id="auth-tab-signin"
            onClick={() => {
              setMode('signin');
              setError(null);
              setResetSent(false);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-white text-[#0F172A] shadow-xs border border-[#E2E8F0]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            id="auth-tab-signup"
            onClick={() => {
              setMode('signup');
              setError(null);
              setResetSent(false);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-white text-[#0F172A] shadow-xs border border-[#E2E8F0]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Main Card */}
        <div className={`mt-4 ${CARD_STYLE} p-6 sm:p-8`}>
          {error && (
            <div
              id="auth-error-alert"
              className="mb-4 p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-lg text-xs text-[#DC2626] flex items-start space-x-2"
            >
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resetSent && (
            <div
              id="auth-reset-sent-alert"
              className="mb-4 p-3 bg-[#F0FDFA] border border-[#99F6E4] rounded-lg text-xs text-[#0F766E] flex items-start space-x-2"
            >
              <CheckCircle2 className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
              <span>
                If an account exists for <strong>{email.trim()}</strong>, a password reset
                link has been sent — check your inbox.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account Type Selector (for sign up) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  I am registering as:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRole('distributor')}
                    className={`flex items-center justify-center space-x-2 p-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      role === 'distributor'
                        ? 'border-[#0F766E] bg-[#F0FDFA] text-[#0F766E] shadow-xs'
                        : 'border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-[#0F766E]" />
                    <span>Distributor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('retailer')}
                    className={`flex items-center justify-center space-x-2 p-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      role === 'retailer'
                        ? 'border-[#0F766E] bg-[#F0FDFA] text-[#0F766E] shadow-xs'
                        : 'border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Store className="w-4 h-4 text-[#0F766E]" />
                    <span>Kirana Retailer</span>
                  </button>
                </div>
              </div>
            )}

            {/* Name input (for sign up) */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-[#0F172A] mb-1">
                  {role === 'distributor' ? 'Distributor Business Name' : 'Kirana Store Name'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={
                      role === 'distributor'
                        ? 'e.g. Anand Agencies, Ward Road'
                        : 'e.g. Ramesh Kirana Provision Store'
                    }
                    className="block w-full pl-9 pr-3 py-2 border border-[#E2E8F0] rounded-lg text-xs bg-[#F8FAFC] text-[#0F172A] placeholder-[#64748B]/60 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-[#0F172A] mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@business.com"
                  className="block w-full pl-9 pr-3 py-2 border border-[#E2E8F0] rounded-lg text-xs bg-[#F8FAFC] text-[#0F172A] placeholder-[#64748B]/60 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="auth-password" className="block text-xs font-medium text-[#0F172A]">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    id="auth-forgot-password-btn"
                    type="button"
                    disabled={isSendingReset}
                    onClick={handleForgotPassword}
                    className="text-[11px] font-semibold text-[#0F766E] hover:text-[#14B8A6] disabled:opacity-50 cursor-pointer"
                  >
                    {isSendingReset ? 'Sending...' : 'Forgot password?'}
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 border border-[#E2E8F0] rounded-lg text-xs bg-[#F8FAFC] text-[#0F172A] placeholder-[#64748B]/60 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className={`w-full ${BUTTON_STYLES.primary} py-2.5 mt-2`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span>{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins for Reviewers */}
          <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-[#64748B] text-center mb-2.5 uppercase tracking-wider">
              Try a Demo Account
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="demo-login-distributor-btn"
                onClick={() => {
                  setMode('signin');
                  handleQuickFill('dist@fmcg.com', 'password123');
                }}
                className="p-2 bg-[#F0FDFA] hover:bg-[#CCFBF1] text-[#0F766E] border border-[#99F6E4]/70 rounded-lg text-left text-xs transition-colors cursor-pointer"
              >
                <div className="font-bold flex items-center space-x-1">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Distributor</span>
                </div>
                <div className="text-[10px] text-[#64748B] truncate mt-0.5">dist@fmcg.com</div>
              </button>

              <button
                type="button"
                id="demo-login-retailer-btn"
                onClick={() => {
                  setMode('signin');
                  handleQuickFill('retailer@kirana.com', 'password123');
                }}
                className="p-2 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] border border-[#BFDBFE] rounded-lg text-left text-xs transition-colors cursor-pointer"
              >
                <div className="font-bold flex items-center space-x-1">
                  <Store className="w-3.5 h-3.5" />
                  <span>Retailer</span>
                </div>
                <div className="text-[10px] text-[#64748B] truncate mt-0.5">retailer@kirana.com</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
