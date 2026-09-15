import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { isFirebaseConfigured } from '../lib/firebase';

/**
 * A misconfigured production deploy (missing/placeholder Firebase env vars)
 * would otherwise fail silently — every login/write just breaks with a
 * generic Firebase SDK error and no clear signal why. This makes that
 * unmissable to anyone opening the site, not just someone checking devtools.
 */
export const ConfigWarningBanner: React.FC = () => {
  if (!import.meta.env.PROD || isFirebaseConfigured) {
    return null;
  }

  return (
    <div
      id="config-warning-banner"
      className="bg-[#DC2626] text-white text-xs sm:text-sm font-medium px-4 py-2 flex items-center justify-center gap-2 text-center"
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>
        Configuration error: Firebase environment variables are missing on this deploy.
        Sign-in and data will not work.
      </span>
    </div>
  );
};
