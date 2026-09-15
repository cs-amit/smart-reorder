import { useEffect, useRef, useState } from 'react';

/**
 * True once the referenced element has scrolled into view — then stays true
 * (the observer disconnects after the first hit). Used to trigger entrance
 * animations only when a section is actually about to become visible,
 * rather than the moment the whole page mounts (which would let a
 * below-the-fold animation finish playing before anyone scrolls to see it).
 */
export function useInView<T extends HTMLElement>(rootMargin = '0px 0px -10% 0px') {
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, isInView };
}
