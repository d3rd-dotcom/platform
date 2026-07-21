'use client';

import Link from 'next/link';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import type { KnowledgeMap, KnowledgeMapNode } from '@/lib/guides-db';
import styles from './LandingKnowledgeGraph.module.css';

type Position = [number, number, number];

interface PlacedNode {
  node: KnowledgeMapNode;
  position: Position;
  subject: string;
  color: string;
  unlockCount: number;
  seed: number;
}

interface GraphLayout {
  nodes: PlacedNode[];
  byId: Map<string, PlacedNode>;
  edgePositions: Float32Array;
  subjects: string[];
}

// Varied editorial palette, deepened so each node reads against the light
// surface the graph now sits on: indigo, coral, teal, periwinkle, rose, deep
// navy, amber, and a cyan secondary. Small lightness jitter is applied below.
const SUBJECT_COLORS = [
  '#4a3fd1',
  '#e0402a',
  '#0f9c8a',
  '#5566d4',
  '#d94f83',
  '#1d2f7a',
  '#c5761a',
  '#1a86ad',
];

// Entrance timing: nodes rise in from the foundations up.
const RISE = 0.7;
const LEVEL_STAGGER = 0.5;
// Slow universal rotation of the whole graph (radians/sec), instead of each
// node spinning on its own — one calm drift reads far less busy.
const SPIN_SPEED = 0.09;

function hashText(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function primarySubject(node: KnowledgeMapNode): string {
  return node.subjects[0]?.trim() || 'Foundations';
}

function buildLayout(map: KnowledgeMap): GraphLayout {
  const subjects = Array.from(new Set(map.nodes.map(primarySubject))).sort((a, b) =>
    a.localeCompare(b),
  );
  const subjectIndex = new Map(subjects.map((subject, index) => [subject, index]));
  const dependentCount = new Map<string, number>();

  for (const node of map.nodes) {
    for (const prereqId of node.prereqIds) {
      dependentCount.set(prereqId, (dependentCount.get(prereqId) ?? 0) + 1);
    }
  }

  const levelSpan = Math.max(map.levels - 1, 1);
  const nodesByLevel = new Map<number, KnowledgeMapNode[]>();
  for (const node of map.nodes) {
    const list = nodesByLevel.get(node.level);
    if (list) list.push(node);
    else nodesByLevel.set(node.level, [node]);
  }

  const placed = Array.from(nodesByLevel.entries()).flatMap(([level, levelNodes]) => {
    const normalizedLevel = level / levelSpan;
    const funnelRadius = 0.42 + Math.pow(normalizedLevel, 0.82) * 4.3;
    const y = -3.25 + normalizedLevel * 6.5;
    const sorted = [...levelNodes].sort((a, b) => {
      const subjectCompare = primarySubject(a).localeCompare(primarySubject(b));
      return subjectCompare || a.topicTitle.localeCompare(b.topicTitle);
    });

    return sorted.map((node, index) => {
      const subject = primarySubject(node);
      const subjectSlot = subjectIndex.get(subject) ?? 0;
      const subjectAngle = (subjectSlot / Math.max(subjects.length, 1)) * Math.PI * 2;
      const localSpread =
        sorted.length > 1 ? ((index / sorted.length) * Math.PI * 2) / Math.max(subjects.length, 1) : 0;
      const jitter = (hashText(node.id) - 0.5) * 0.34;
      const radius = funnelRadius * (0.9 + hashText(`${node.id}:radius`) * 0.18);
      const angle = subjectAngle + localSpread + jitter;

      const baseColor = new THREE.Color(SUBJECT_COLORS[subjectSlot % SUBJECT_COLORS.length]);
      baseColor.offsetHSL(0, 0, (hashText(`${node.id}:tint`) - 0.5) * 0.16);

      return {
        node,
        subject,
        color: `#${baseColor.getHexString()}`,
        unlockCount: dependentCount.get(node.id) ?? 0,
        seed: hashText(`${node.id}:seed`) * Math.PI * 2,
        position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius] as Position,
      };
    });
  });

  const byId = new Map(placed.map((item) => [item.node.id, item]));
  const edgeValues: number[] = [];

  for (const item of placed) {
    for (const prereqId of item.node.prereqIds) {
      const prereq = byId.get(prereqId);
      if (!prereq) continue;
      edgeValues.push(...prereq.position, ...item.position);
    }
  }

  return {
    nodes: placed,
    byId,
    edgePositions: new Float32Array(edgeValues),
    subjects,
  };
}

function connectedIds(selectedId: string | null, byId: Map<string, PlacedNode>): Set<string> {
  if (!selectedId) return new Set();

  const connected = new Set<string>([selectedId]);
  const visitPrereqs = (id: string) => {
    const item = byId.get(id);
    if (!item) return;
    for (const prereqId of item.node.prereqIds) {
      if (connected.has(prereqId)) continue;
      connected.add(prereqId);
      visitPrereqs(prereqId);
    }
  };
  visitPrereqs(selectedId);

  const unlocks = new Map<string, string[]>();
  for (const item of byId.values()) {
    for (const prereqId of item.node.prereqIds) {
      const list = unlocks.get(prereqId);
      if (list) list.push(item.node.id);
      else unlocks.set(prereqId, [item.node.id]);
    }
  }

  const queue = [selectedId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const unlockedId of unlocks.get(current) ?? []) {
      if (connected.has(unlockedId)) continue;
      connected.add(unlockedId);
      queue.push(unlockedId);
    }
  }

  return connected;
}

/** A single node: a flat-shaded sphere that reads as a solid circle from any
 *  angle. */
function GraphNode({
  item,
  appearDelay,
  reducedMotion,
  highlighted,
  dimmed,
  selected,
  onSelect,
  onHover,
}: {
  item: PlacedNode;
  appearDelay: number;
  reducedMotion: boolean;
  highlighted: boolean;
  dimmed: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null, clientX?: number, clientY?: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);

  const baseScale = 0.11 + Math.min(item.unlockCount, 6) * 0.02;
  const baseCore = dimmed ? 0.14 : 1;

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const appear = reducedMotion ? 1 : Math.min(1, Math.max(0, (t - appearDelay) / RISE));
    const eased = appear * appear * (3 - 2 * appear); // smoothstep

    // Rise up into place from just below.
    g.position.set(item.position[0], item.position[1] - (1 - eased) * 0.7, item.position[2]);

    const pulse = highlighted && !reducedMotion ? 1 + Math.sin(t * 3 + item.seed) * 0.07 : 1;
    g.scale.setScalar(baseScale * eased * pulse * (selected ? 1.28 : 1));

    if (coreMat.current) coreMat.current.opacity = baseCore * eased;
  });

  // Selected reads as near-ink so it still pops on the light field.
  const color = selected ? '#12131c' : item.color;

  return (
    <group
      ref={groupRef}
      position={item.position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(item.node.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
        onHover(item.node.id, event.nativeEvent.clientX, event.nativeEvent.clientY);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        onHover(item.node.id, event.nativeEvent.clientX, event.nativeEvent.clientY);
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
        onHover(null);
      }}
    >
      <mesh>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial ref={coreMat} color={color} transparent opacity={baseCore} />
      </mesh>
    </group>
  );
}

function CameraRig({ distance }: { distance: number }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.z = distance;
    camera.updateProjectionMatrix();
  }, [camera, distance]);

  return null;
}

function GraphScene({
  layout,
  selectedId,
  reducedMotion,
  rotation,
  cameraDistance,
  hoveredId,
  dragging,
  onSelect,
  onHover,
}: {
  layout: GraphLayout;
  selectedId: string | null;
  reducedMotion: boolean;
  rotation: { x: number; y: number };
  cameraDistance: number;
  hoveredId: string | null;
  dragging: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null, clientX?: number, clientY?: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const edgeMat = useRef<THREE.LineBasicMaterial>(null);
  const autoSpinRef = useRef(0);
  const connected = useMemo(() => connectedIds(selectedId, layout.byId), [layout.byId, selectedId]);

  // Static render path (reduced motion / off-screen 'demand' loop): reflect the
  // drag rotation without the animated spin below overriding it every frame.
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.x = rotation.x;
    groupRef.current.rotation.y = rotation.y + autoSpinRef.current;
  }, [rotation]);

  useFrame(({ clock }, delta) => {
    // One slow universal drift for the whole graph; paused while dragging so the
    // pointer stays in control.
    const g = groupRef.current;
    if (g) {
      if (!reducedMotion && !dragging) autoSpinRef.current += delta * SPIN_SPEED;
      g.rotation.x = rotation.x;
      g.rotation.y = rotation.y + autoSpinRef.current;
    }

    // Soft ink edges fade in just behind the nodes.
    if (edgeMat.current) {
      const target = selectedId ? 0.16 : 0.3;
      const appear = reducedMotion ? 1 : Math.min(1, Math.max(0, (clock.elapsedTime - 0.4) / 1.2));
      edgeMat.current.opacity = target * appear;
    }
  });

  return (
    <>
      <CameraRig distance={cameraDistance} />
      <group ref={groupRef} rotation={[rotation.x, rotation.y, 0]}>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[layout.edgePositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            ref={edgeMat}
            color="#39406e"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </lineSegments>

        {layout.nodes.map((item) => {
          const pathDimmed = selectedId !== null && !connected.has(item.node.id);
          const highlighted = item.node.id === hoveredId || item.node.id === selectedId;
          return (
            <GraphNode
              key={item.node.id}
              item={item}
              appearDelay={item.node.level * LEVEL_STAGGER + hashText(item.node.id) * 0.2}
              reducedMotion={reducedMotion}
              highlighted={highlighted}
              dimmed={pathDimmed}
              selected={item.node.id === selectedId}
              onSelect={onSelect}
              onHover={onHover}
            />
          );
        })}
      </group>
    </>
  );
}

interface HoverPos {
  x: number;
  y: number;
  flipX: boolean;
  flipY: boolean;
}

export default function LandingKnowledgeGraph() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; rotationX: number; rotationY: number } | null>(
    null,
  );
  const velocityRef = useRef({ x: 0, y: 0 });
  const inertiaFrameRef = useRef<number | null>(null);
  const [map, setMap] = useState<KnowledgeMap | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<HoverPos | null>(null);
  const [rotation, setRotation] = useState({ x: -0.12, y: 0.28 });
  const [cameraDistance, setCameraDistance] = useState(11.5);
  const [dragging, setDragging] = useState(false);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/guides/map?public=1', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Map unavailable');
        const data = (await response.json()) as { map?: KnowledgeMap };
        const nextMap = data.map ?? null;
        setMap(nextMap);
        setStatus(nextMap?.nodes.length ? 'ready' : 'empty');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('error');
      });
    return () => controller.abort();
  }, []);

  useEffect(
    () => () => {
      if (inertiaFrameRef.current !== null) cancelAnimationFrame(inertiaFrameRef.current);
      document.body.style.cursor = '';
    },
    [],
  );

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: '120px',
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const layout = useMemo(() => (map ? buildLayout(map) : null), [map]);
  const hoverItem =
    hoveredId && layout ? layout.byId.get(hoveredId) ?? null : null;
  const selected = selectedId && layout ? layout.byId.get(selectedId) ?? null : null;

  const handleHover = useCallback(
    (id: string | null, clientX?: number, clientY?: number) => {
      setHoveredId(id);
      if (id !== null && clientX !== undefined && clientY !== undefined && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        setHoverPos({ x, y, flipX: x > rect.width * 0.58, flipY: y > rect.height * 0.55 });
      }
    },
    [],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (inertiaFrameRef.current !== null) {
        cancelAnimationFrame(inertiaFrameRef.current);
        inertiaFrameRef.current = null;
      }
      velocityRef.current = { x: 0, y: 0 };
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        rotationX: rotation.x,
        rotationY: rotation.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      setHoveredId(null);
    },
    [rotation],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const nextX = Math.max(-0.8, Math.min(0.55, drag.rotationX + (event.clientY - drag.y) * 0.004));
      const nextY = drag.rotationY + (event.clientX - drag.x) * 0.006;
      velocityRef.current = {
        x: Math.max(-0.035, Math.min(0.035, nextX - rotation.x)),
        y: Math.max(-0.055, Math.min(0.055, nextY - rotation.y)),
      };
      setRotation({ x: nextX, y: nextY });
    },
    [rotation],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragging(false);

      if (reducedMotion) return;
      const step = () => {
        velocityRef.current.x *= 0.91;
        velocityRef.current.y *= 0.91;
        const { x, y } = velocityRef.current;
        if (Math.abs(x) + Math.abs(y) < 0.0004) {
          inertiaFrameRef.current = null;
          return;
        }
        setRotation((current) => ({
          x: Math.max(-0.8, Math.min(0.55, current.x + x)),
          y: current.y + y,
        }));
        inertiaFrameRef.current = requestAnimationFrame(step);
      };
      inertiaFrameRef.current = requestAnimationFrame(step);
    },
    [reducedMotion],
  );

  return (
    <div className={styles.graphShell}>
      <div
        ref={wrapperRef}
        className={`${styles.viewport} ${dragging ? styles.viewportDragging : ''}`}
        data-cursor="grab"
        aria-label="Interactive three-dimensional map of published guide prerequisites"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={(event) => {
          event.preventDefault();
          setCameraDistance((current) =>
            Math.max(7.5, Math.min(15, current + event.deltaY * 0.008)),
          );
        }}
      >
        {status === 'ready' && layout ? (
          <Canvas
            camera={{ position: [0, 0.1, cameraDistance], fov: 45 }}
            dpr={[1, 1.75]}
            frameloop={inView && !reducedMotion ? 'always' : 'demand'}
            gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          >
            <GraphScene
              layout={layout}
              selectedId={selectedId}
              reducedMotion={reducedMotion}
              rotation={rotation}
              cameraDistance={cameraDistance}
              hoveredId={hoveredId}
              dragging={dragging}
              onSelect={setSelectedId}
              onHover={handleHover}
            />
          </Canvas>
        ) : (
          <div className={styles.graphState}>
            {status === 'loading' && 'Mapping the curriculum…'}
            {status === 'empty' && 'The first published guides will become the roots of this map.'}
            {status === 'error' && 'The live knowledge map is temporarily unavailable.'}
          </div>
        )}

        <div className={styles.axisLabel} aria-hidden="true">
          <span>Advanced</span>
          <span>Foundations</span>
        </div>

        {hoverItem && hoverPos && !dragging && (
          <div
            className={styles.hoverAnchor}
            style={{
              left: hoverPos.x,
              top: hoverPos.y,
              transform: `translate(${hoverPos.flipX ? 'calc(-100% - 18px)' : '18px'}, ${
                hoverPos.flipY ? '-100%' : '0'
              })`,
            }}
          >
            <div className={styles.hoverCard}>
              <div className={styles.hoverHead}>
                <span
                  className={styles.hoverDot}
                  style={{ background: hoverItem.color }}
                  aria-hidden="true"
                />
                <span className={styles.hoverMeta}>
                  {hoverItem.subject} · Level {hoverItem.node.level + 1}
                </span>
              </div>
              <strong className={styles.hoverTitle}>{hoverItem.node.topicTitle}</strong>
              {hoverItem.node.summary && (
                <p className={styles.hoverBody}>{hoverItem.node.summary}</p>
              )}
              <span className={styles.hoverStats}>
                {hoverItem.node.prereqIds.length} prerequisites · {hoverItem.unlockCount} unlocks
              </span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.detailPanel} aria-live="polite">
        {selected ? (
          <>
            <div className={styles.detailCopy}>
              <span className={styles.detailMeta}>
                Level {selected.node.level + 1} · {selected.subject}
              </span>
              <strong className={styles.detailTitle}>{selected.node.topicTitle}</strong>
              <span className={styles.detailStats}>
                {selected.node.prereqIds.length} prerequisites · {selected.unlockCount} direct unlocks
              </span>
            </div>
            <Link className={styles.detailLink} href={`/home/guides/${selected.node.slug}`}>
              Open guide
            </Link>
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.detailGif} src="/images/walking.gif" alt="Blue walking" />
            <div className={styles.detailCopy}>
              <strong className={styles.detailTitle}>
                171 topics peer-reviewed by PhD Students across 11 levels
              </strong>
            </div>
            <Link className={styles.detailLink} href="/home/guides/map">
              Open full map
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
