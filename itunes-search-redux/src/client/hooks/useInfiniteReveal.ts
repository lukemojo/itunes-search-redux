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
      // The sentinel has no height of its own, so without a margin it can sit
      // exactly on the viewport edge and never register as intersecting.
      { rootMargin: '200px 0px' },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [enabled, onReveal]);

  return sentinelRef;
}
