import { useEffect, useRef } from 'react';

/**
 * Calls onReveal whenever the returned sentinel element scrolls into view —
 * IntersectionObserver instead of scroll math, so there's no listener churn.
 * Attach the ref to an element rendered only while more content exists;
 * `enabled` false (or an unmounted sentinel) disconnects the observer.
 */
export function useInfiniteReveal(onReveal: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!enabled || !el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onReveal();
      },
      // The rootMargin is required to ensure intersection is triggered
      // before the sentinel is actually visible, allowing for prefetching of data.
      { rootMargin: '200px 0px' },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [enabled, onReveal]);

  return sentinelRef;
}
