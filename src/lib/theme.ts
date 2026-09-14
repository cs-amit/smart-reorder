/**
 * Core Design System Tokens & Semantic Helpers
 * Strictly implements the specified palette:
 * - Primary: #0F766E (deep teal), hover/active: #14B8A6, subtle tint: #F0FDFA
 * - Neutrals: text #0F172A, secondary #64748B, borders #E2E8F0, page background #F8FAFC
 * - Status (actual meaning, not decoration):
 *   - Green #16A34A only for "Confident" predictions and success states
 *   - Amber #D97706 only for "due soon" / "Learning" tier
 *   - Red #DC2626 only for "overdue"
 *   - Blue #2563EB only for informational/neutral states
 */

export const THEME = {
  primary: {
    DEFAULT: '#0F766E',
    hover: '#14B8A6',
    subtle: '#F0FDFA',
    border: '#99F6E4',
    text: '#0F766E',
  },
  neutrals: {
    text: '#0F172A',
    secondaryText: '#64748B',
    border: '#E2E8F0',
    pageBg: '#F8FAFC',
    cardBg: '#FFFFFF',
  },
  status: {
    confident: '#16A34A', // Green only for Confident & success
    learning: '#D97706',  // Amber only for due soon / Learning
    overdue: '#DC2626',   // Red only for overdue
    info: '#2563EB',      // Blue only for informational/neutral
  },
} as const;

export const BUTTON_STYLES = {
  primary:
    'inline-flex items-center justify-center font-medium rounded-lg text-sm px-4 py-2 bg-[#0F766E] text-white hover:bg-[#14B8A6] active:bg-[#0D655E] shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'inline-flex items-center justify-center font-medium rounded-lg text-sm px-4 py-2 bg-white text-[#0F172A] border border-[#E2E8F0] hover:bg-[#F8FAFC] hover:border-[#64748B]/40 active:bg-[#F1F5F9] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  subtle:
    'inline-flex items-center justify-center font-medium rounded-lg text-sm px-3 py-1.5 bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]/70 hover:bg-[#CCFBF1] transition-colors cursor-pointer disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center font-medium rounded-lg text-sm px-4 py-2 bg-white text-[#DC2626] border border-[#FCA5A5] hover:bg-[#FEF2F2] transition-colors cursor-pointer disabled:opacity-50',
} as const;

export const CARD_STYLE =
  'bg-white rounded-xl border border-[#E2E8F0] shadow-xs';

/**
 * Returns consistent semantic badge styling based on prediction confidence or status
 */
export function getSemanticConfidenceBadge(confidence: string = 'cold') {
  const norm = confidence.toLowerCase();
  if (norm === 'confident') {
    return {
      label: 'Confident',
      bg: 'bg-[#DCFCE7]',
      text: 'text-[#16A34A]',
      border: 'border-[#BBF7D0]',
      dot: '#16A34A',
    };
  }
  if (norm === 'learning') {
    return {
      label: 'Learning',
      bg: 'bg-[#FEF3C7]',
      text: 'text-[#D97706]',
      border: 'border-[#FDE68A]',
      dot: '#D97706',
    };
  }
  // Cold / minimal data -> subtle neutral
  return {
    label: 'Cold',
    bg: 'bg-[#F1F5F9]',
    text: 'text-[#64748B]',
    border: 'border-[#E2E8F0]',
    dot: '#64748B',
  };
}

/**
 * Returns consistent semantic badge styling for urgency status
 */
export function getSemanticStatusBadge(status: 'overdue' | 'due' | 'upcoming' | string) {
  if (status === 'overdue') {
    return {
      label: 'Overdue',
      bg: 'bg-[#FEE2E2]',
      text: 'text-[#DC2626]',
      border: 'border-[#FECACA]',
    };
  }
  if (status === 'due') {
    return {
      label: 'Due Soon',
      bg: 'bg-[#FEF3C7]',
      text: 'text-[#D97706]',
      border: 'border-[#FDE68A]',
    };
  }
  return {
    label: 'Upcoming',
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#2563EB]',
    border: 'border-[#BFDBFE]',
  };
}
