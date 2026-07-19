'use client';

import React, { useEffect, useRef, useState } from 'react';
import type * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './ProblemMap.module.css';

const GEOJSON_URL = '/data/redlining-oakland.geojson';
const SAN_FRANCISCO_REDLINE_URL = '/data/redlining-san-francisco.geojson';
const PRIVATE_AREA_LABEL = 'D18';
const MAX_MAP_ZOOM = 11.25;

const RESOURCE_GROUPS = [
  { label: 'Marginalized', units: 1, tone: 'marginalized' },
  { label: 'Wealthy', units: 3, tone: 'wealthy' },
  { label: 'Private', units: 5, tone: 'private' },
] as const;

// Show the full HOLC grading field. D (redlined) and A ("best"/wealthy) remain
// the strongest figures, while the B and C survey areas complete the historical
// context rather than leaving most of the city visually unmarked.
const HIDDEN: L.PathOptions = { weight: 0, fillOpacity: 0, interactive: false };
const GRADE_STYLE: Record<string, L.PathOptions> = {
  D: { color: 'var(--color-danger)', weight: 1, fillColor: 'var(--color-danger)', fillOpacity: 0.52, interactive: false },
  A: { color: 'var(--color-streak)', weight: 1, fillColor: 'var(--color-streak)', fillOpacity: 0.48, interactive: false },
  B: { color: 'var(--color-primary)', weight: 0.6, fillColor: 'var(--color-primary)', fillOpacity: 0.32, interactive: false },
  C: { color: 'var(--color-warning)', weight: 0.6, fillColor: 'var(--color-warning)', fillOpacity: 0.34, interactive: false },
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

function markerHtml(variant: 'red' | 'green' | 'private'): string {
  return (
    `<div class="rl-mk rl-${variant}">` +
    `<span class="rl-cap">${SCHOOL_SVG}</span>` +
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

      map = LR.map(containerRef.current, {
        center: [37.78, -122.33],
        zoom: 10.5,
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

      const oaklandLayer = LR.geoJSON(data, {
        style: (f) => {
          if (f?.properties?.label === PRIVATE_AREA_LABEL) return PRIVATE_AREA_STYLE;
          return (f?.properties?.grade && GRADE_STYLE[f.properties.grade]) || HIDDEN;
        },
        interactive: false,
      }).addTo(map);

      const sanFranciscoLayer = LR.geoJSON(sanFranciscoData, {
        style: (feature) => (feature?.properties?.grade && GRADE_STYLE[feature.properties.grade]) || HIDDEN,
        interactive: false,
      }).addTo(map);

      const surveyBounds = oaklandLayer.getBounds();
      surveyBounds.extend(sanFranciscoLayer.getBounds());
      map.fitBounds(surveyBounds, {
        animate: false,
        maxZoom: MAX_MAP_ZOOM,
        padding: [12, 12],
      });

      const icon = (variant: 'red' | 'green' | 'private') =>
        LR.divIcon({ html: markerHtml(variant), className: '', iconSize: [0, 0], iconAnchor: [0, 0] });

      const liveMap = map;
      const m = data.metadata.markers || {};
      const redlined: number[][] = Array.isArray(m.redlined)
        ? (Array.isArray(m.redlined[0]) ? m.redlined : [m.redlined])
        : [];
      const southernmostRedlined = Math.min(...redlined.map((pt) => pt[1]));
      redlined.forEach((pt) => {
        const isPrivate = pt[1] === southernmostRedlined;
        LR.marker([pt[1], pt[0]], {
          icon: icon(isPrivate ? 'private' : 'red'),
          interactive: false,
          keyboard: false,
        }).addTo(liveMap);
      });
      if (m.wealthy) {
        LR.marker([m.wealthy[1], m.wealthy[0]], { icon: icon('green'), interactive: false, keyboard: false }).addTo(map);
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
        className={styles.flow}
        role="group"
        aria-label="Historic redlining shaped neighborhood wealth and access to education resources. In 2017, 19 percent of assessed U.S. adults ages 16 to 65 performed at Level 1 or below in English literacy."
      >
        <article className={`${styles.stage} ${styles.mapStage}`}>
          <div
            ref={containerRef}
            className={styles.map}
            aria-hidden="true"
          />
          <div className={styles.mapShade} aria-hidden="true" />
          <div className={styles.mapStory}>
            <div className={styles.stageHeading}>
              <span className={styles.stageNumber}>1</span>
              <h3 className={styles.stageTitle}>Historic redlining</h3>
            </div>
            <div className={styles.mapStoryFooter}>
              <p className={styles.stageCopy}>
                Housing policy shaped neighborhood wealth and opportunity.
              </p>
              <div className={styles.mapLegend} aria-hidden="true">
                <span><i className={styles.gradeA} />Grade A</span>
                <span><i className={styles.gradeD} />Grade D</span>
              </div>
            </div>
          </div>
        </article>

        <article className={`${styles.stage} ${styles.resourceStage}`}>
          <div className={styles.stageHeaderBlock}>
            <div className={styles.stageHeading}>
              <span className={styles.stageNumber}>2</span>
              <h3 className={styles.stageTitle}>Unequal school resources</h3>
            </div>
            <span className={styles.resourceQualifier}>Illustrative comparison</span>
          </div>
          <div className={styles.resourcePlot}>
            {RESOURCE_GROUPS.map((group) => (
              <div className={styles.resourceGroup} key={group.label}>
                <div
                  className={`${styles.resourceStack} ${styles[group.tone]}`}
                  aria-hidden="true"
                >
                  {Array.from({ length: group.units }).map((_, index) => (
                    <i key={index} />
                  ))}
                </div>
                <span className={styles.resourceLabel}>{group.label}</span>
              </div>
            ))}
          </div>
          <p className={styles.stageCopy}>
            Where a student lives still influences the education resources around them.
          </p>
        </article>

        <article className={`${styles.stage} ${styles.outcomeStage}`}>
          <div className={styles.stageHeading}>
            <span className={styles.stageNumber}>3</span>
            <h3 className={styles.stageTitle}>Compounding outcomes</h3>
          </div>
          <div className={styles.outcome}>
            <strong className={styles.outcomeValue}>19%</strong>
            <p className={styles.outcomeCopy}>
              of assessed U.S. adults ages 16–65 performed at Level 1 or below
              in English literacy in 2017.
            </p>
            <div className={styles.people} aria-hidden="true">
              {Array.from({ length: 10 }).map((_, index) => (
                <i className={index < 2 ? styles.personActive : undefined} key={index} />
              ))}
            </div>
          </div>
          <p className={styles.stageCopy}>
            Barriers accumulate across place, access, and time.
          </p>
        </article>
      </div>

      <p className={styles.source}>
        Map: Mapping Inequality, Digital Scholarship Lab, University of Richmond;
        OpenStreetMap and CARTO. Literacy: NCES PIAAC 2017. Resource stacks are illustrative.
      </p>
    </div>
  );
};

export default ProblemMap;
