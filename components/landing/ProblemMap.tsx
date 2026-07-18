'use client';

import React, { useEffect, useRef, useState } from 'react';
import type * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './ProblemMap.module.css';

const GEOJSON_URL = '/data/redlining-oakland.geojson';
const SAN_FRANCISCO_REDLINE_URL = '/data/redlining-san-francisco.geojson';
const PRIVATE_AREA_LABEL = 'D18';
const INITIAL_MAP_ZOOM = 11.25;

// Show the full HOLC grading field. D (redlined) and A ("best"/wealthy) remain
// the strongest figures, while the B and C survey areas complete the historical
// context rather than leaving most of the city visually unmarked.
const HIDDEN: L.PathOptions = { weight: 0, fillOpacity: 0, interactive: false };
const GRADE_STYLE: Record<string, L.PathOptions> = {
  D: { color: 'var(--color-danger)', weight: 1, fillColor: 'var(--color-danger)', fillOpacity: 0.52, interactive: false },
  A: { color: 'var(--color-streak)', weight: 1, fillColor: 'var(--color-streak)', fillOpacity: 0.48, interactive: false },
  B: { color: '#6f86ff', weight: 0.6, fillColor: '#6f86ff', fillOpacity: 0.32, interactive: false },
  C: { color: '#e0a53b', weight: 0.6, fillColor: '#e0a53b', fillOpacity: 0.34, interactive: false },
};
const PRIVATE_AREA_STYLE: L.PathOptions = {
  color: 'var(--color-accent)',
  weight: 1,
  fillColor: 'var(--color-accent)',
  fillOpacity: 0.52,
  interactive: false,
};

const SCHOOL_SVG =
  '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">' +
  '<path d="M12 3 1 8l11 5 9-4.09V14h2V8L12 3zM5 13.18v2.5L12 19l7-3.32v-2.5L12 16 5 13.18z"/></svg>';

function coinStack(coins: number): string {
  return `<span class="rl-stack">${'<i class="rl-coin"></i>'.repeat(coins)}</span>`;
}

function markerHtml(variant: 'red' | 'green' | 'private', coins: number): string {
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
    const controller = new AbortController();

    const reveal = () => containerRef.current?.classList.add(styles.mapReady);

    (async () => {
      const mod = await import('leaflet');
      const LR = (((mod as unknown as { default?: typeof L }).default ?? mod) as typeof L);
      if (cancelled || !containerRef.current) return;

      const [oaklandResponse, sanFranciscoResponse] = await Promise.all([
        fetch(GEOJSON_URL, { signal: controller.signal }),
        fetch(SAN_FRANCISCO_REDLINE_URL, { signal: controller.signal }),
      ]);
      if (!oaklandResponse.ok || !sanFranciscoResponse.ok) {
        throw new Error('Problem map data could not be loaded.');
      }

      const [data, sanFranciscoData] = await Promise.all([
        oaklandResponse.json(),
        sanFranciscoResponse.json(),
      ]);
      if (cancelled || !containerRef.current) return;

      const [minLon, minLat, maxLon, maxLat] = data.metadata.bbox as number[];
      const bounds = LR.latLngBounds([minLat, minLon], [maxLat, maxLon]);
      const mapCenter = bounds.getCenter();

      map = LR.map(containerRef.current, {
        center: mapCenter,
        zoom: INITIAL_MAP_ZOOM,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomSnap: 0,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
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
        style: (f) => {
          if (f?.properties?.label === PRIVATE_AREA_LABEL) return PRIVATE_AREA_STYLE;
          return (f?.properties?.grade && GRADE_STYLE[f.properties.grade]) || HIDDEN;
        },
        interactive: false,
      }).addTo(map);

      LR.geoJSON(sanFranciscoData, {
        style: (feature) => (feature?.properties?.grade && GRADE_STYLE[feature.properties.grade]) || HIDDEN,
        interactive: false,
      }).addTo(map);

      const icon = (variant: 'red' | 'green' | 'private', coins: number) =>
        LR.divIcon({ html: markerHtml(variant, coins), className: '', iconSize: [0, 0], iconAnchor: [0, 0] });

      const liveMap = map;
      const m = data.metadata.markers || {};
      const redlined: number[][] = Array.isArray(m.redlined)
        ? (Array.isArray(m.redlined[0]) ? m.redlined : [m.redlined])
        : [];
      const southernmostRedlined = Math.min(...redlined.map((pt) => pt[1]));
      redlined.forEach((pt) => {
        const isPrivate = pt[1] === southernmostRedlined;
        LR.marker([pt[1], pt[0]], {
          icon: icon(isPrivate ? 'private' : 'red', isPrivate ? 5 : 1),
          interactive: false,
          keyboard: false,
        }).addTo(liveMap);
      });
      if (m.wealthy) {
        LR.marker([m.wealthy[1], m.wealthy[0]], { icon: icon('green', 3), interactive: false, keyboard: false }).addTo(map);
      }

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
      map?.remove();
    };
  }, [visible]);

  return (
    <div className={styles.wrap}>
      <div
        ref={containerRef}
        className={styles.map}
        role="img"
        aria-label="Map of historic redlining areas in Oakland and San Francisco."
      />

      <p className={styles.source}>
        Redlining areas: Mapping Inequality, Digital Scholarship Lab, University of Richmond.
        Map &copy; OpenStreetMap, &copy; CARTO.
      </p>

    </div>
  );
};

export default ProblemMap;
