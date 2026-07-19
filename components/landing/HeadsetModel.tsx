'use client';

/**
 * Procedural Three.js rebuild of Blue's side-of-head earpiece from the character
 * art. A sleek white armor plate (rounded-hexagon, raised rim with rivets) carries
 * the red "J" mark; two glossy blue-glass lenses with thin gold rims and bright
 * anime shine-dots sit at the lower edge like goggle optics.
 * Code-only: every part is a primitive or one extruded shape. No mesh downloads.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const COLORS = {
  shell: '#e2e1dd',
  shellHi: '#f2f1ee',
  shellEdge: '#b9b8b4',
  rivet: '#8f8f93',
  rivetDark: '#6d6d72',
  gold: '#c59b3f',
  goldHi: '#e6c56a',
  goldDeep: '#7c5c1f',
  glassBlue: '#3f7ec6',
  glassDeep: '#12305e',
  glassEdge: '#0d2140',
  shine: '#eef6ff',
  logoRed: '#d23a2c',
  amber: '#f2822b',
} as const;

/** Front face Z of the extruded plate — surface details ride just above this. */
const FACE_Z = 0.16;

/**
 * The armor-plate outline: a clean top-heavy shield with faceted (straight-cut)
 * edges and two small deliberate steps, tapering to the lenses at the bottom.
 */
const PLATE_OUTLINE: [number, number][] = [
  [-0.54, 0.44],
  [-0.36, 0.76], // top-left corner
  [-0.04, 0.84], // shallow top peak
  [0.3, 0.78], // top-right corner
  [0.54, 0.54],
  [0.6, 0.16], // subtle step on the right
  [0.5, -0.32],
  [0.3, -0.6], // bottom-right
  [-0.04, -0.74], // bottom point
  [-0.38, -0.58],
  [-0.58, -0.16],
  [-0.5, 0.06], // subtle step on the left
  [-0.58, 0.24],
];

function outlineShape(points: [number, number][]) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  return shape;
}

function centroid(points: [number, number][]): [number, number] {
  const s = points.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [s[0] / points.length, s[1] / points.length];
}

function LogoMark() {
  const geometry = useMemo(() => {
    // Crescent moon: a big disc with an offset smaller disc bitten out of one side.
    const R1 = 0.34; // outer disc
    const R2 = 0.28; // cutting disc
    const d = 0.16; // offset of the cut
    const x = (d * d + R1 * R1 - R2 * R2) / (2 * d);
    const y = Math.sqrt(Math.max(0, R1 * R1 - x * x));
    const a1 = Math.atan2(y, x); // horn angle on the outer disc
    const a2 = Math.atan2(y, x - d); // horn angle on the cutting disc
    const s = new THREE.Shape();
    s.moveTo(R1 * Math.cos(a1), R1 * Math.sin(a1));
    s.absarc(0, 0, R1, a1, 2 * Math.PI - a1, false); // outer curve, the long way round
    s.absarc(d, 0, R2, 2 * Math.PI - a2, a2, true); // concave inner bite
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
    geo.center();
    return geo;
  }, []);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={COLORS.logoRed} roughness={0.45} metalness={0.05} />
    </mesh>
  );
}

/** Goggle lens: gunmetal ring barrel, bright gold rim, convex blue glass, shine-dots. Local +Z out. */
function LensPod({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      {/* short barrel so the lens stands slightly off the plate */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.07]}>
        <cylinderGeometry args={[0.31, 0.35, 0.18, 48]} />
        <meshStandardMaterial color="#3a3a3f" roughness={0.5} metalness={0.55} />
      </mesh>
      {/* bright gold rim */}
      <mesh position={[0, 0, 0.15]}>
        <torusGeometry args={[0.29, 0.05, 20, 56]} />
        <meshStandardMaterial color={COLORS.gold} roughness={0.24} metalness={1} />
      </mesh>
      {/* thin dark-blue inner ring (glass edge) */}
      <mesh position={[0, 0, 0.17]}>
        <torusGeometry args={[0.24, 0.035, 16, 48]} />
        <meshStandardMaterial color={COLORS.glassEdge} roughness={0.3} metalness={0.4} />
      </mesh>
      {/* convex blue glass */}
      <mesh position={[0, 0, 0.1]} scale={[1, 1, 0.55]}>
        <sphereGeometry args={[0.255, 44, 34]} />
        <meshPhysicalMaterial
          color={COLORS.glassBlue}
          roughness={0.12}
          metalness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.06}
          emissive={COLORS.glassDeep}
          emissiveIntensity={0.45}
        />
      </mesh>
      {/* big crescent shine top-left */}
      <mesh position={[-0.08, 0.09, 0.24]} rotation={[0, 0, 0.5]} scale={[1.7, 0.9, 1]}>
        <sphereGeometry args={[0.055, 18, 18]} />
        <meshStandardMaterial color={COLORS.shine} emissive={COLORS.shine} emissiveIntensity={1.3} toneMapped={false} />
      </mesh>
      {/* small secondary shine bottom-right */}
      <mesh position={[0.09, -0.07, 0.24]}>
        <sphereGeometry args={[0.03, 14, 14]} />
        <meshStandardMaterial color={COLORS.shine} emissive="#d3e8ff" emissiveIntensity={1.1} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ArmorPlate() {
  const bodyGeo = useMemo(
    () =>
      new THREE.ExtrudeGeometry(outlineShape(PLATE_OUTLINE), {
        depth: 0.1,
        bevelEnabled: true,
        bevelThickness: 0.045,
        bevelSize: 0.05,
        bevelSegments: 2,
      }),
    []
  );

  // Raised inner panel: the same outline pulled toward its centroid, sitting proud
  // so the untouched border reads as a rim.
  const innerGeo = useMemo(() => {
    const [cx, cy] = centroid(PLATE_OUTLINE);
    const inner = PLATE_OUTLINE.map(
      ([x, y]) => [cx + (x - cx) * 0.8, cy + (y - cy) * 0.8] as [number, number]
    );
    return new THREE.ExtrudeGeometry(outlineShape(inner), {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
  }, []);

  // Rivets follow the jagged rim: one just inside each outline vertex.
  const rivets = useMemo<[number, number][]>(() => {
    const [cx, cy] = centroid(PLATE_OUTLINE);
    return PLATE_OUTLINE.map(
      ([x, y]) => [cx + (x - cx) * 0.86, cy + (y - cy) * 0.86] as [number, number]
    );
  }, []);

  return (
    <group>
      {/* plate body + raised rim */}
      <mesh geometry={bodyGeo}>
        <meshStandardMaterial color={COLORS.shellEdge} roughness={0.4} metalness={0.35} />
      </mesh>
      <mesh geometry={innerGeo} position={[0, 0, 0.06]}>
        <meshStandardMaterial color={COLORS.shell} roughness={0.38} metalness={0.32} />
      </mesh>

      {/* rivets on the rim */}
      {rivets.map((r, i) => (
        <mesh key={i} position={[r[0], r[1], FACE_Z - 0.02]}>
          <sphereGeometry args={[0.023, 16, 14]} />
          <meshStandardMaterial color={COLORS.rivetDark} roughness={0.3} metalness={0.75} />
        </mesh>
      ))}

      {/* small amber indicator near the top-right rim */}
      <group position={[0.36, 0.52, FACE_Z + 0.02]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.5, 1, 0.9]}>
          <cylinderGeometry args={[0.055, 0.055, 0.04, 24]} />
          <meshStandardMaterial color={COLORS.amber} emissive={COLORS.amber} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      </group>

      {/* red crescent mark, centered high on the panel */}
      <group position={[-0.08, 0.28, FACE_Z + 0.03]} rotation={[0, 0, -0.2]} scale={0.72}>
        <LogoMark />
      </group>

      {/* two small blue-glass lenses tucked at the lower edge, toward the ear */}
      <group position={[-0.02, -0.56, FACE_Z + 0.05]} rotation={[-0.14, -0.05, 0]}>
        <LensPod scale={0.64} />
      </group>
      <group position={[-0.34, -0.3, FACE_Z + 0.06]} rotation={[-0.08, 0.12, 0]}>
        <LensPod scale={0.54} />
      </group>
    </group>
  );
}

export function HeadsetModel({ spin = true }: { spin?: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    if (spin) {
      group.current.rotation.y = -0.12 + Math.sin(state.clock.elapsedTime * 0.35) * 0.18;
    }
  });

  return (
    // Plate faces the camera, tilted slightly so the rim bevel and lenses read in 3D.
    <group ref={group} position={[0, 0.06, 0]} rotation={[0.03, -0.14, 0.04]} scale={1.5}>
      <ArmorPlate />
    </group>
  );
}

export function HeadsetCanvas({ spin = true }: { spin?: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0.1, 5], fov: 34 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#ffffff', '#a8a49c', 1]} />
      <directionalLight position={[3.5, 4.5, 4]} intensity={2.1} />
      <directionalLight position={[-4, 2, 2]} intensity={0.9} color="#e8ecff" />
      <directionalLight position={[-2, -2, 4]} intensity={0.5} color="#ffffff" />
      <HeadsetModel spin={spin} />
    </Canvas>
  );
}
