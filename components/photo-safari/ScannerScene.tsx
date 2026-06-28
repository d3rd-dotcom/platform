'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import * as THREE from 'three';

export interface ScannerSceneHandle {
  capture: () => string | null;
}

// ── Video Background ──
function VideoBackground({ stream }: { stream: MediaStream }) {
  const ref = useRef<THREE.Mesh>(null!);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { viewport } = useThree();

  useEffect(() => {
    if (!stream) return;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();
    video.muted = true;
    video.playsInline = true;
    videoRef.current = video;

    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.map = texture;
    mat.needsUpdate = true;

    function fit() {
      if (!video.videoWidth) return;
      const va = video.videoWidth / video.videoHeight;
      const ca = viewport.width / viewport.height;
      if (va > ca) {
        const s = viewport.height;
        ref.current.scale.set(s * va, s, 1);
      } else {
        const s = viewport.width;
        ref.current.scale.set(s, s / va, 1);
      }
    }

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      fit();
    } else {
      video.onloadedmetadata = fit;
    }

    return () => {
      texture.dispose();
      video.pause();
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const va = video.videoWidth / video.videoHeight;
    const ca = viewport.width / viewport.height;
    if (va > ca) {
      const s = viewport.height;
      ref.current.scale.set(s * va, s, 1);
    } else {
      const s = viewport.width;
      ref.current.scale.set(s, s / va, 1);
    }
  }, [viewport]);

  return (
    <mesh ref={ref}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </mesh>
  );
}

// ── Scan Line ──
function ScanLine() {
  const ref = useRef<THREE.Mesh>(null!);
  const { viewport } = useThree();

  useFrame(({ clock }) => {
    const t = Math.sin(clock.elapsedTime * 0.7) * 0.5 + 0.5;
    const range = viewport.height * 0.78;
    ref.current.position.y = (t - 0.5) * range;
  });

  return (
    <mesh ref={ref}>
      <planeGeometry args={[viewport.width * 0.70, 0.035]} />
      <meshBasicMaterial color="#00ff88" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
}

// ── Reticle ──
function Reticle() {
  const { viewport } = useThree();
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);
  const r = Math.min(viewport.width, viewport.height) * 0.045;
  const tickDist = r * 1.15;

  useFrame(({ clock }) => {
    const pulse = Math.sin(clock.elapsedTime * 1.5) * 0.12 + 0.4;
    matRef.current.opacity = pulse;
  });

  return (
    <group>
      <mesh>
        <ringGeometry args={[r * 0.85, r, 48]} />
        <meshBasicMaterial ref={matRef} color="#00ff88" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[r * 0.12, 12]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.25} depthWrite={false} />
      </mesh>
      {[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y], i) => (
        <mesh key={i} position={[x * tickDist, y * tickDist, 0]}>
          <planeGeometry args={[x === 0 ? 0.015 : r * 0.3, y === 0 ? 0.015 : r * 0.3]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Corner Brackets ──
function CornerBrackets() {
  const { viewport } = useThree();
  const x = viewport.width * 0.38;
  const y = viewport.height * 0.38;
  const s = Math.min(viewport.width, viewport.height);
  const len = s * 0.035;
  const t = 0.02;

  const corners = [
    { px: -x, py: -y, angle: 0 },
    { px: x, py: -y, angle: Math.PI / 2 },
    { px: x, py: y, angle: Math.PI },
    { px: -x, py: y, angle: -Math.PI / 2 },
  ];

  return (
    <group>
      {corners.map((c, i) => (
        <group key={i} position={[c.px, c.py, 0]} rotation={[0, 0, c.angle]}>
          <mesh position={[len / 2 - 0.01, 0, 0]}>
            <planeGeometry args={[len, t]} />
            <meshBasicMaterial color="#00ff88" transparent opacity={0.4} depthWrite={false} />
          </mesh>
          <mesh position={[0, len / 2 - 0.01, 0]}>
            <planeGeometry args={[t, len]} />
            <meshBasicMaterial color="#00ff88" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Floating Particles ──
function ScanParticles() {
  const ref = useRef<THREE.Points>(null!);
  const { viewport } = useThree();
  const count = 25;

  const [geo] = useState(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * viewport.width;
      p[i * 3 + 1] = (Math.random() - 0.5) * viewport.height;
      p[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  });

  const velRef = useRef(new Float32Array(count * 3));

  useEffect(() => {
    const v = velRef.current;
    for (let i = 0; i < count; i++) {
      v[i * 3] = (Math.random() - 0.5) * 0.003;
      v[i * 3 + 1] = Math.random() * 0.006 + 0.003;
    }
  }, []);

  useFrame(() => {
    const p = geo.attributes.position.array as Float32Array;
    const v = velRef.current;
    for (let i = 0; i < count; i++) {
      p[i * 3] += v[i * 3];
      p[i * 3 + 1] += v[i * 3 + 1];
      if (p[i * 3 + 1] > viewport.height / 2) {
        p[i * 3 + 1] = -viewport.height / 2;
        p[i * 3] = (Math.random() - 0.5) * viewport.width;
      }
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.025} color="#00ff88" transparent opacity={0.35} depthWrite={false} />
    </points>
  );
}

// ── Scene Content ──
function SceneContent({ stream }: { stream: MediaStream }) {
  return (
    <>
      <VideoBackground stream={stream} />
      <ScanLine />
      <Reticle />
      <CornerBrackets />
      <ScanParticles />
    </>
  );
}

// ── Scanner Scene (Canvas wrapper) ──
interface ScannerSceneProps {
  stream: MediaStream;
}

const ScannerScene = forwardRef<ScannerSceneHandle, ScannerSceneProps>(
  ({ stream }, ref) => {
    const glRef = useRef<THREE.WebGLRenderer | null>(null);

    useImperativeHandle(ref, () => ({
      capture() {
        if (!glRef.current) return null;
        return glRef.current.domElement.toDataURL('image/jpeg', 0.7);
      },
    }));

    return (
      <Canvas
        onCreated={({ gl }) => {
          glRef.current = gl;
          gl.setClearColor(0x000000, 1);
        }}
        camera={{ position: [0, 0, 5], fov: 60, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <SceneContent stream={stream} />
      </Canvas>
    );
  },
);

ScannerScene.displayName = 'ScannerScene';
export default ScannerScene;
