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
}

interface GraphLayout {
  nodes: PlacedNode[];
  byId: Map<string, PlacedNode>;
  edgePositions: Float32Array;
  subjects: string[];
}

const SUBJECT_COLORS = ['#5168ff', '#8f7cff', '#69a7ff', '#f277a5', '#d6a4ff', '#ffb86b'];

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

      return {
        node,
        subject,
        color: SUBJECT_COLORS[subjectSlot % SUBJECT_COLORS.length],
        unlockCount: dependentCount.get(node.id) ?? 0,
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

function GraphNode({
  item,
  active,
  dimmed,
  selected,
  onSelect,
  onHover,
}: {
  item: PlacedNode;
  active: boolean;
  dimmed: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const scale = 0.19 + Math.min(item.unlockCount, 6) * 0.024;

  useFrame(({ clock }) => {
    if (!meshRef.current || !active) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.8 + hashText(item.node.id) * 8) * 0.08;
    meshRef.current.scale.setScalar(pulse);
  });

  return (
    <mesh
      ref={meshRef}
      position={item.position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(item.node.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
        onHover(item.node.id);
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
        onHover(null);
      }}
    >
      <sphereGeometry args={[scale, 18, 18]} />
      <meshBasicMaterial
        color={selected ? '#ffffff' : item.color}
        transparent
        opacity={dimmed ? 0.16 : item.node.completed ? 1 : 0.82}
      />
      <mesh scale={2.2}>
        <sphereGeometry args={[scale, 18, 18]} />
        <meshBasicMaterial color={item.color} transparent opacity={dimmed ? 0.025 : 0.1} />
      </mesh>
      {selected && (
        <mesh scale={1.75}>
          <sphereGeometry args={[scale, 18, 18]} />
          <meshBasicMaterial color="#5168ff" wireframe transparent opacity={0.9} />
        </mesh>
      )}
    </mesh>
  );
}

function NodeLabel({ item }: { item: PlacedNode }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 112;
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.fillStyle = 'rgba(5, 6, 10, 0.92)';
    context.beginPath();
    context.roundRect(4, 4, 632, 104, 22);
    context.fill();
    context.strokeStyle = 'rgba(81, 104, 255, 0.9)';
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = '#ffffff';
    context.font = '600 28px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const label =
      item.node.topicTitle.length > 38
        ? `${item.node.topicTitle.slice(0, 37)}…`
        : item.node.topicTitle;
    context.fillText(label, 320, 56);

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [item]);

  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;

  return (
    <sprite position={[item.position[0], item.position[1] + 0.48, item.position[2]]} scale={[3.1, 0.54, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
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
  activeSubject,
  animate,
  rotation,
  cameraDistance,
  hoveredId,
  onSelect,
  onHover,
}: {
  layout: GraphLayout;
  selectedId: string | null;
  activeSubject: string;
  animate: boolean;
  rotation: { x: number; y: number };
  cameraDistance: number;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const connected = useMemo(() => connectedIds(selectedId, layout.byId), [layout.byId, selectedId]);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.x = rotation.x;
    groupRef.current.rotation.y = rotation.y;
  }, [rotation]);

  return (
    <>
      <CameraRig distance={cameraDistance} />
      <group ref={groupRef} rotation={[rotation.x, rotation.y, 0]}>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[layout.edgePositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#7184ff" transparent opacity={selectedId ? 0.22 : 0.44} />
        </lineSegments>

        {layout.nodes.map((item) => {
          const subjectDimmed = activeSubject !== 'All topics' && item.subject !== activeSubject;
          const pathDimmed = selectedId !== null && !connected.has(item.node.id);
          return (
            <GraphNode
              key={item.node.id}
              item={item}
              active={animate}
              dimmed={subjectDimmed || pathDimmed}
              selected={item.node.id === selectedId}
              onSelect={onSelect}
              onHover={onHover}
            />
          );
        })}

        {(hoveredId || selectedId) && (
          <NodeLabel item={layout.byId.get(hoveredId ?? selectedId!)!} />
        )}
      </group>
    </>
  );
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
  const [activeSubject, setActiveSubject] = useState('All topics');
  const [rotation, setRotation] = useState({ x: -0.12, y: 0.28 });
  const [cameraDistance, setCameraDistance] = useState(10.2);
  const [dragging, setDragging] = useState(false);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/guides/map', { cache: 'no-store', signal: controller.signal })
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
  const selected = selectedId && layout ? layout.byId.get(selectedId) ?? null : null;
  const subjectTabs = useMemo(
    () => ['All topics', ...(layout?.subjects.slice(0, 4) ?? [])],
    [layout],
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
    },
    [rotation],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const nextX = Math.max(-0.8, Math.min(0.55, drag.rotationX + (event.clientY - drag.y) * 0.004));
    const nextY = drag.rotationY + (event.clientX - drag.x) * 0.006;
    velocityRef.current = {
      x: Math.max(-0.035, Math.min(0.035, nextX - rotation.x)),
      y: Math.max(-0.055, Math.min(0.055, nextY - rotation.y)),
    };
    setRotation({ x: nextX, y: nextY });
  }, [rotation]);

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
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
  }, [reducedMotion]);

  return (
    <div className={styles.graphShell}>
      <div className={styles.graphToolbar}>
        <div className={styles.tabs} aria-label="Filter knowledge graph by subject">
          {subjectTabs.map((subject) => (
            <button
              key={subject}
              type="button"
              className={`${styles.tab} ${activeSubject === subject ? styles.tabActive : ''}`}
              onClick={() => setActiveSubject(subject)}
            >
              {subject}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.resetButton}
          onClick={() => {
            if (inertiaFrameRef.current !== null) cancelAnimationFrame(inertiaFrameRef.current);
            inertiaFrameRef.current = null;
            velocityRef.current = { x: 0, y: 0 };
            setRotation({ x: -0.12, y: 0.28 });
            setCameraDistance(10.2);
            setSelectedId(null);
            setActiveSubject('All topics');
          }}
        >
          Reset view
        </button>
      </div>

      <div
        ref={wrapperRef}
        className={`${styles.viewport} ${dragging ? styles.viewportDragging : ''}`}
        aria-label="Interactive three-dimensional map of published guide prerequisites"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={(event) => {
          event.preventDefault();
          setCameraDistance((current) =>
            Math.max(7.2, Math.min(14.5, current + event.deltaY * 0.008)),
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
              activeSubject={activeSubject}
              animate={inView && !reducedMotion && !dragging}
              rotation={rotation}
              cameraDistance={cameraDistance}
              hoveredId={hoveredId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
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

        <div className={styles.graphHint}>Drag to rotate · Scroll to zoom · Select a node</div>
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
            <Link className={styles.detailLink} href={`/courses/guides/${selected.node.slug}`}>
              Open guide
            </Link>
          </>
        ) : (
          <>
            <div className={styles.detailCopy}>
              <span className={styles.detailMeta}>Live guide graph</span>
              <strong className={styles.detailTitle}>
                {map?.nodes.length ?? 0} verified topics across {map?.levels ?? 0} levels
              </strong>
              <span className={styles.detailStats}>
                Height follows prerequisite depth. Color follows subject.
              </span>
            </div>
            <Link className={styles.detailLink} href="/courses/guides/map">
              Open full map
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
