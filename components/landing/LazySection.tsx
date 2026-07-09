'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface LazySectionProps {
  children: ReactNode;
  /**
   * Height the placeholder reserves before the section mounts. Keep it close to
   * the section's real height so the page is scrollable from first paint and the
   * content swap causes no layout jump. Any CSS length (default one viewport).
   */
  minHeight?: string;
  /**
   * How far ahead of the viewport to start mounting. A generous margin means the
   * section is usually loaded by the time it scrolls into view.
   */
  rootMargin?: string;
}

/**
 * Renders its children only once the wrapper scrolls near the viewport, then
 * keeps them mounted. This spreads hydration of the below-the-fold landing
 * sections across the scroll instead of firing them all at once, and gives the
 * page its full scrollable height immediately via the reserved min-height.
 *
 * The min-height stays applied to the wrapper even after `shown` flips true —
 * never just to a pre-mount placeholder. Children are next/dynamic(ssr:false)
 * imports that render nothing for a moment while their chunk resolves; without
 * a persistent min-height that null render collapses this section, which slides
 * the NEXT section's wrapper into the intersection zone and mounts it too — a
 * cascade that converts every section within one frame of load regardless of
 * scroll position, defeating the point of deferring by scroll.
 */
export function LazySection({
  children,
  minHeight = '100vh',
  rootMargin = '300px',
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;

    // Environments without IntersectionObserver just render eagerly.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown, rootMargin]);

  return (
    <div ref={ref} style={{ minHeight }} aria-hidden={shown ? undefined : true}>
      {shown ? children : null}
    </div>
  );
}

export default LazySection;
