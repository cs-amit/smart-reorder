import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors anywhere below it and shows a recoverable
 * screen instead of a blank white page. React error boundaries can only be
 * class components — there is no hook equivalent.
 */
export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className={`${CARD_STYLE} max-w-md w-full p-6 sm:p-8 text-center space-y-4`}>
          <div className="w-14 h-14 rounded-full bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[#0F172A]">Something went wrong</h1>
            <p className="text-sm text-[#64748B] mt-1.5">
              This screen hit an unexpected error. Your data is safe — reloading usually
              fixes it.
            </p>
          </div>
          <button
            id="error-boundary-reload-btn"
            type="button"
            onClick={() => window.location.reload()}
            className={`${BUTTON_STYLES.primary} w-full py-2.5`}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            <span>Reload the app</span>
          </button>
        </div>
      </div>
    );
  }
}
