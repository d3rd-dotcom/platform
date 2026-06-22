'use client';

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useRef, useEffect, memo } from "react";
import * as THREE from "three";
import { cubeFragmentShader, cubeVertexShader } from './cubeShaders';

const getDPR = () => {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
};

const RotatingCube = memo(({ position, rotationSpeed, scale, verticalSpeed, horizontalOnly, bgColor }: {
  position: [number, number, number];
  rotationSpeed: [number, number, number];
  scale: number;
  verticalSpeed: number;
  horizontalOnly: boolean;
  bgColor: THREE.Vector3;
}) => {
  const mesh = useRef<THREE.Mesh>(null);
  const dprRef = useRef(getDPR());
  const textureRef = useRef<THREE.Texture | null>(null);
  const basePosition = useRef<[number, number, number]>(position);

  useEffect(() => {
    if (!textureRef.current && typeof window !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
        ctx.fillRect(0, 0, 256, 256);
        textureRef.current = new THREE.CanvasTexture(canvas);
        textureRef.current.needsUpdate = true;
        if (mesh.current?.material) {
          const material = mesh.current.material as THREE.ShaderMaterial;
          if (material.uniforms?.utexture) {
            material.uniforms.utexture.value = textureRef.current;
          }
        }
      }
    }
  }, []);

  const uniforms = useRef({
    time: { value: 0.0 },
    rotationSpeed: { value: new THREE.Vector3(...rotationSpeed) },
    horizontalOnly: { value: horizontalOnly ? 1.0 : 0.0 },
    ucolor1: { value: new THREE.Vector3(0.32, 0.41, 1.00) },
    ucolor2: { value: new THREE.Vector3(1.00, 0.47, 0.16) },
    ucolor3: { value: new THREE.Vector3(0.59, 0.14, 0.65) },
    ucolor4: { value: new THREE.Vector3(0.051, 0.580, 0.533) },
    ucolor5: { value: new THREE.Vector3(0.91, 0.33, 0.43) },
    ucolor6: { value: new THREE.Vector3(0.45, 0.77, 0.40) },
    asciicode: { value: 100.0 },
    utexture: { value: null as THREE.Texture | null },
    uAsciiImageTexture: { value: new THREE.Texture() },
    uBackgroundColor: { value: bgColor.clone() },
    brightness: { value: 1.3 },
    asciiu: { value: 1.0 },
    resolution: {
      value: new THREE.Vector2(
        typeof window !== 'undefined' ? window.innerWidth * dprRef.current : 1920,
        typeof window !== 'undefined' ? window.innerHeight * dprRef.current : 1080
      ),
    },
  }).current;

  useEffect(() => {
    if (textureRef.current && uniforms.utexture) {
      uniforms.utexture.value = textureRef.current;
    }
  }, [uniforms]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateResolution = () => {
      dprRef.current = getDPR();
      if (uniforms.resolution.value && window.innerWidth > 0 && window.innerHeight > 0) {
        uniforms.resolution.value.set(window.innerWidth * dprRef.current, window.innerHeight * dprRef.current);
      }
    };
    updateResolution();
    window.addEventListener('resize', updateResolution);
    return () => window.removeEventListener('resize', updateResolution);
  }, [uniforms]);

  useFrame((state) => {
    if (!mesh.current) return;
    const material = mesh.current.material as THREE.ShaderMaterial;
    if (material.uniforms) material.uniforms.time.value = state.clock.getElapsedTime();
    const yOffset = Math.sin(state.clock.getElapsedTime() * verticalSpeed) * 1.5;
    mesh.current.position.y = basePosition.current[1] + yOffset;
  });

  return (
    <mesh ref={mesh} position={position} scale={scale}>
      <boxGeometry args={[1.0, 1.0, 1.0]} />
      <shaderMaterial fragmentShader={cubeFragmentShader} vertexShader={cubeVertexShader} uniforms={uniforms} />
    </mesh>
  );
});

RotatingCube.displayName = 'RotatingCube';

const CubesScene = memo(({ bgColor }: { bgColor: THREE.Vector3 }) => {
  const cubes = [];
  const count = 10;
  const cameraZ = 10;
  const fov = 75;
  const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9;
  const fovRad = (fov * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * cameraZ;
  const visibleWidth = visibleHeight * aspect;

  // Place cubes heavily biased to the right so some are always visible on load.
  // On landscape: 2 left (mostly hidden / peek-in), 8 right (always visible).
  // On portrait: 2 top, 8 bottom.
  const rightCount = 8;
  const leftCount = count - rightCount;
  const isLandscape = aspect >= 1;

  for (let i = 0; i < count; i++) {
    const side = i < leftCount ? -1 : 1;
    const idx = side === -1 ? i : i - leftCount;
    const groupSize = side === -1 ? leftCount : rightCount;
    const t = groupSize > 1 ? idx / (groupSize - 1) : 0;

    let x: number, y: number;
    if (isLandscape) {
      if (side === -1) {
        const xBase = visibleWidth * (0.48 + Math.random() * 0.06);
        x = -(xBase + Math.random() * visibleWidth * 0.04);
      } else {
        const xBase = visibleWidth * (0.25 + Math.random() * 0.18);
        x = xBase + (Math.random() - 0.5) * visibleWidth * 0.04;
      }
      y = (t - 0.5) * visibleHeight * 0.92 + (Math.random() - 0.5) * visibleHeight * 0.10;
    } else {
      x = (t - 0.5) * visibleWidth * 0.88 + (Math.random() - 0.5) * visibleWidth * 0.08;
      const yBase = visibleHeight * (0.28 + Math.random() * 0.18);
      y = side * yBase;
    }

    // Pin the topmost right-side cube to a guaranteed top-right position.
    if (isLandscape && side === 1 && idx === rightCount - 1) {
      x = visibleWidth * 0.38;
      y = visibleHeight * 0.42;
    }

    cubes.push({
      position: [x, y, (Math.random() - 0.5) * 6] as [number, number, number],
      rotationSpeed: [(Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4] as [number, number, number],
      scale: 1.5 + Math.random() * 2.0,
      verticalSpeed: (Math.random() - 0.5) * 0.8,
      horizontalOnly: Math.random() < 0.4,
    });
  }

  return (
    <>
      {cubes.map((cube, i) => (
        <RotatingCube key={i} {...cube} bgColor={bgColor} />
      ))}
    </>
  );
});

CubesScene.displayName = 'CubesScene';

const BgColor = memo(() => {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = null;
  }, [scene]);
  return null;
});

BgColor.displayName = 'BgColor';

type CohortCubesProps = {
  bgColor?: string;
  /**
   * When false, the render loop is paused (frameloop="demand") so the cubes
   * render a single static frame instead of animating every rAF tick. Used to
   * respect prefers-reduced-motion and to stop burning the main thread while
   * the canvas is scrolled out of view — both major INP wins.
   */
  animate?: boolean;
};

const CohortCubes = memo(({ bgColor = '#FFFFFF', animate = true }: CohortCubesProps) => {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const bgVec = new THREE.Color(bgColor);
  const bgVector3 = new THREE.Vector3(bgVec.r, bgVec.g, bgVec.b);

  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 75 }}
      dpr={[dpr, dpr]}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: true, stencil: false, depth: true }}
      frameloop={animate ? 'always' : 'demand'}
      performance={{ min: 0.5 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <BgColor />
      <Suspense fallback={null}>
        <CubesScene bgColor={bgVector3} />
      </Suspense>
    </Canvas>
  );
});

CohortCubes.displayName = 'CohortCubes';

export default CohortCubes;
