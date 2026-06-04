'use client';

import React, { useEffect, useRef, useState } from 'react';
import type * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './ProblemMap.module.css';

const GEOJSON_URL = '/data/redlining-oakland.geojson';

// HOLC grades. D (redlined) and A ("best"/wealthy) are the figures; B and C stay
// faint so the map reads as a real graded gradient, not a binary two-box split.
const HIDDEN: L.PathOptions = { weight: 0, fillOpacity: 0, interactive: false };
const GRADE_STYLE: Record<string, L.PathOptions> = {
  D: { color: '#5168FF', weight: 1, fillColor: '#3248D8', fillOpacity: 0.62, interactive: false },
  A: { color: '#5fbf78', weight: 1, fillColor: '#5aa469', fillOpacity: 0.48, interactive: false },
  B: { color: '#6f86ff', weight: 0, fillColor: '#6f86ff', fillOpacity: 0.16, interactive: false },
  C: { color: '#e0a53b', weight: 0, fillColor: '#e0a53b', fillOpacity: 0.18, interactive: false },
};

const SCHOOL_SVG =
  '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">' +
  '<path d="M12 3 1 8l11 5 9-4.09V14h2V8L12 3zM5 13.18v2.5L12 19l7-3.32v-2.5L12 16 5 13.18z"/></svg>';

function coinStack(coins: number): string {
  return `<span class="rl-stack">${'<i class="rl-coin"></i>'.repeat(coins)}</span>`;
}

function markerHtml(variant: 'red' | 'green', coins: number): string {
  const stack = coins > 0 ? coinStack(coins) : '';
  return (
    `<div class="rl-mk rl-${variant}">` +
    `<span class="rl-mkBody"><span class="rl-cap">${SCHOOL_SVG}</span>${stack}</span>` +
    `<span class="rl-pin"></span>` +
    `</div>`
  );
}

export const ProblemMap: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Only build the (tile-fetching) map once it scrolls near the viewport.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    let map: L.Map | null = null;
    let ro: ResizeObserver | null = null;
    const controller = new AbortController();

    const reveal = () => containerRef.current?.classList.add(styles.mapReady);

    (async () => {
      const mod = await import('leaflet');
      const LR = (((mod as unknown as { default?: typeof L }).default ?? mod) as typeof L);
      if (cancelled || !containerRef.current) return;

      const res = await fetch(GEOJSON_URL, { signal: controller.signal });
      const data = await res.json();
      if (cancelled || !containerRef.current) return;

      const [minLon, minLat, maxLon, maxLat] = data.metadata.bbox as number[];
      const bounds = LR.latLngBounds([minLat, minLon], [maxLat, maxLon]);

      map = LR.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomSnap: 0,
      });

      const tiles = LR.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          subdomains: 'abcd',
          maxZoom: 19,
          detectRetina: true,
        },
      ).addTo(map);
      tiles.on('load', reveal);

      LR.geoJSON(data, {
        style: (f) => (f?.properties?.grade && GRADE_STYLE[f.properties.grade]) || HIDDEN,
        interactive: false,
      }).addTo(map);

      const icon = (variant: 'red' | 'green', coins: number) =>
        LR.divIcon({ html: markerHtml(variant, coins), className: '', iconSize: [0, 0], iconAnchor: [0, 0] });

      const liveMap = map;
      const m = data.metadata.markers || {};
      const redlined: number[][] = Array.isArray(m.redlined)
        ? (Array.isArray(m.redlined[0]) ? m.redlined : [m.redlined])
        : [];
      redlined.forEach((pt) => {
        LR.marker([pt[1], pt[0]], { icon: icon('red', 2), interactive: false, keyboard: false }).addTo(liveMap);
      });
      if (m.wealthy) {
        LR.marker([m.wealthy[1], m.wealthy[0]], { icon: icon('green', 6), interactive: false, keyboard: false }).addTo(map);
      }

      const fit = () => {
        if (!map || !containerRef.current) return;
        map.invalidateSize({ animate: false });
        map.fitBounds(bounds, { padding: [16, 16] });
      };
      fit();

      ro = new ResizeObserver(fit);
      ro.observe(containerRef.current);

      // Backstop: never leave the panel invisible if a tile 'load' never fires.
      window.setTimeout(reveal, 1500);
    })().catch((err) => {
      if (err?.name !== 'AbortError') {
        console.error('ProblemMap:', err);
        reveal();
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
      ro?.disconnect();
      map?.remove();
    };
  }, [visible]);

  return (
    <div className={styles.wrap}>
      <div
        ref={containerRef}
        className={styles.map}
        role="img"
        aria-label="Map of Oakland, California from the 1930s federal Home Owners' Loan Corporation survey. Neighborhoods shaded red were graded hazardous and redlined; neighborhoods shaded green were graded best. A public school sits in each."
      />

      <div className={styles.mechanism}>
        <p className={styles.lead}>
          Public schools run on local property taxes &mdash; so the line drawn on this
          1930s map became a school-funding line.
        </p>
        <div className={styles.budget}>
          <span className={styles.budgetTitle}>Annual funding per school</span>
          <div className={styles.budgetTable}>
            <span className={styles.budgetLabel} data-zone="red">Redlined</span>
            <span className={styles.budgetCoins} aria-hidden="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <i key={i} className={styles.budgetCoin} />
              ))}
            </span>
            <span className={styles.budgetLabel} data-zone="green">High-income</span>
            <span className={styles.budgetCoins} aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <i key={i} className={styles.budgetCoin} />
              ))}
            </span>
          </div>
        </div>
        <p className={styles.source}>
          Map &copy; OpenStreetMap, &copy; CARTO.
        </p>
      </div>
    </div>
  );
};

export default ProblemMap;
