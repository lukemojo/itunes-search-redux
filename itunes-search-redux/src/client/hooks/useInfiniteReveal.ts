import { useEffect, useRef } from 'react';

/**
 * Calls onReveal whenever the returned sentinel element scrolls into view —
 * IntersectionObserver instead of scroll math, so there's no listener churn.
 * Attach the ref to an element rendered only while more content exists;
 * `enabled` false (or an unmounted sentinel) disconnects the observer.
 */
export function useInfiniteReveal(onReveal: () => void, enabled: boolean) {
  // Create a ref to hold the sentinel element that will trigger the onReveal callback when it comes into view
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // If the hook is not enabled or the sentinel element is not available, do nothing
    const el = sentinelRef.current;
    if (!enabled || !el) return;

    // Create an IntersectionObserver to observe the sentinel element and call onReveal when it intersects with the viewport
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onReveal();
    });

    // Start observing the sentinel element
    observer.observe(el);

    // Cleanup function to disconnect the observer when the component unmounts or when enabled changes
    return () => observer.disconnect();
  }, [enabled, onReveal]);

  return sentinelRef;
}
