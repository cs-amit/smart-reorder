import React from 'react';
import { useInView } from '../hooks/useInView';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** tw-animate-css animation utility names, e.g. "fade-in slide-in-from-bottom-4" */
  animation?: string;
  /** e.g. "delay-150" */
  delay?: string;
  duration?: string;
}

/**
 * Wraps a section/card so its entrance animation plays only once it
 * actually scrolls into view, not the instant the page mounts — a
 * below-the-fold animation that fires on mount would already be finished
 * by the time anyone scrolls down to see it.
 */
export const Reveal: React.FC<RevealProps> = ({
  children,
  className = '',
  animation = 'fade-in slide-in-from-bottom-4',
  delay = '',
  duration = 'duration-700',
}) => {
  const { ref, isInView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`${className} ${
        isInView ? `animate-in ${animation} ${duration} ${delay} fill-mode-both` : 'opacity-0'
      }`}
    >
      {children}
    </div>
  );
};
