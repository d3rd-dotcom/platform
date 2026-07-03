'use client';

import { useEffect, useRef } from 'react';
import styles from './GardenShader.module.css';

const vertexSrc = [
  'attribute vec2 aPos;',
  'void main() { gl_Position = vec4(aPos, 0.0, 1.0); }',
].join('\n');

const fragmentSrc = [
  'precision highp float;',
  'uniform vec2 uRes;',
  'uniform float uTime;',
  'uniform vec2 uMouse;',
  'uniform float uPixel;',
  '',
  'float hash(vec2 p) {',
  '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
  '  p3 += dot(p3, p3.yzx + 33.33);',
  '  return fract((p3.x + p3.y) * p3.z);',
  '}',
  '',
  'float noise(vec2 p) {',
  '  vec2 i = floor(p);',
  '  vec2 f = fract(p);',
  '  f = f * f * (3.0 - 2.0 * f);',
  '  float a = hash(i + vec2(0.0));',
  '  float b = hash(i + vec2(1.0, 0.0));',
  '  float c = hash(i + vec2(0.0, 1.0));',
  '  float d = hash(i + vec2(1.0, 1.0));',
  '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
  '}',
  '',
  'float fbm(vec2 p) {',
  '  float v = 0.0;',
  '  float a = 0.5;',
  '  for (int i = 0; i < 5; i++) {',
  '    v += a * noise(p);',
  '    p *= 2.0;',
  '    a *= 0.5;',
  '  }',
  '  return v;',
  '}',
  '',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  float a = uRes.x / uRes.y;',
  '  vec2 p = (uv - 0.5) * vec2(a, 1.0);',
  '  float barrel = 0.2 + 0.06 * sin(uTime * 0.12);',
  '  float dist2 = dot(p / vec2(a, 1.0), p / vec2(a, 1.0));',
  '  p = p * (1.0 + barrel * dist2) * 2.5;',
  '',
  '  vec2 mouseP = (uMouse - 0.5) * vec2(a, 1.0);',
  '  float mouseDist = distance(p / 2.5, mouseP);',
  '',
  '  vec2 drift = vec2(',
  '    sin(uTime * 0.08) * 0.5 + cos(uTime * 0.05) * 0.3,',
  '    cos(uTime * 0.1) * 0.4 + sin(uTime * 0.06) * 0.3',
  '  );',
  '',
  '  vec2 q = vec2(',
  '    fbm(p + drift + exp(-mouseDist * 3.0) * 0.3),',
  '    fbm(p + drift * 0.7 + exp(-mouseDist * 3.0) * 0.2)',
  '  );',
  '',
  '  vec2 r = vec2(',
  '    fbm(p + q * 3.0 + vec2(sin(uTime * 0.04 + 1.7), cos(uTime * 0.04 + 9.2))),',
  '    fbm(p + q * 3.0 + vec2(sin(uTime * 0.05 + 8.3), cos(uTime * 0.05 + 2.8)))',
  '  );',
  '',
  '  float f = fbm(p + r * 5.0);',
  '',
  '  float t = sin((f + uTime * 0.015) * 6.28318) * 0.5 + 0.5;',
  '  vec3 col = mix(vec3(0.3, 0.9, 1.0), vec3(1.0), t);',
  '',
  '  float vig = 1.0 - smoothstep(0.15, 1.0, length(uv - 0.5) * 1.4);',
  '  col *= (0.7 + 0.3 * vig);',
  '',
  '  vec2 grainUV = gl_FragCoord.xy * 0.08 * uPixel;',
  '  float gt = uTime * 1.5;',
  '  float gf = fract(gt);',
  '  float g0 = floor(gt);',
  '  float g1 = g0 + 1.0;',
  '  vec3 grain;',
  '  grain.r = mix(hash(grainUV + g0), hash(grainUV + g1), gf);',
  '  grain.g = mix(hash(grainUV + g0 + 100.0), hash(grainUV + g1 + 100.0), gf);',
  '  grain.b = mix(hash(grainUV + g0 + 200.0), hash(grainUV + g1 + 200.0), gf);',
  '  col += (grain - 0.5) * 0.6;',
  '',
  '  float alpha = 0.53 + 0.25 * vig;',
  '  gl_FragColor = vec4(col, alpha);',
  '}',
].join('\n');

// The fbm field is soft and low-frequency, so rendering at reduced
// resolution and letting CSS upscale is visually indistinguishable while
// cutting fragment work to a quarter. The grain is rescaled in-shader
// (uPixel) so its size in CSS pixels stays the same.
const RENDER_SCALE = 0.5;
const MAX_FPS = 30;

export function GardenShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const cvs = canvas;
    const prt = parent;

    let w = Math.max(1, Math.round((prt.clientWidth || window.innerWidth) * RENDER_SCALE));
    let h = Math.max(1, Math.round((prt.clientHeight || window.innerHeight) * RENDER_SCALE));
    cvs.width = w;
    cvs.height = h;

    const gl = cvs.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      // If WebGL would fall back to software rendering (blocklisted GPU
      // drivers, VMs), skip the effect entirely rather than burn CPU —
      // the background image underneath stands on its own.
      failIfMajorPerformanceCaveat: true,
    });
    if (!gl) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const g = gl;

    const vs = (() => {
      const s = gl.createShader(gl.VERTEX_SHADER);
      if (!s) return null;
      gl.shaderSource(s, vertexSrc);
      gl.compileShader(s);
      if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
      console.error('GardenShader vertex shader error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    })();
    const fs = (() => {
      const s = gl.createShader(gl.FRAGMENT_SHADER);
      if (!s) return null;
      gl.shaderSource(s, fragmentSrc);
      gl.compileShader(s);
      if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
      console.error('GardenShader fragment shader error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    })();
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('GardenShader program link error:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return;
    }
    gl.useProgram(prog);

    const quad = new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');
    const uPixel = gl.getUniformLocation(prog, 'uPixel');
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, 0);
    gl.uniform2f(uMouse, 0.5, 0.5);
    gl.uniform1f(uPixel, 1 / RENDER_SCALE);

    // Mousemove can fire far above frame rate (high-polling-rate mice), so
    // the handler only records raw coordinates; the layout read to resolve
    // them against the canvas happens at most once per drawn frame.
    let mouseX = 0.5;
    let mouseY = 0.5;
    let pointerX = -1;
    let pointerY = -1;
    let pointerDirty = false;
    function onMouse(e: MouseEvent) {
      pointerX = e.clientX;
      pointerY = e.clientY;
      pointerDirty = true;
    }
    document.addEventListener('mousemove', onMouse, { passive: true });

    const ro = new ResizeObserver(() => {
      w = Math.max(1, Math.round((prt.clientWidth || window.innerWidth) * RENDER_SCALE));
      h = Math.max(1, Math.round((prt.clientHeight || window.innerHeight) * RENDER_SCALE));
      cvs.width = w;
      cvs.height = h;
      g.viewport(0, 0, w, h);
      g.uniform2f(uRes, w, h);
    });
    ro.observe(prt);

    let animId = 0;
    let running = false;
    let lastDraw = 0;
    // Small slack so a 60Hz rAF cadence lands cleanly on every other frame.
    const minFrameMs = 1000 / MAX_FPS - 2;
    const start = performance.now();

    function frame(now: number) {
      animId = requestAnimationFrame(frame);
      if (now - lastDraw < minFrameMs) return;
      lastDraw = now;

      if (pointerDirty) {
        pointerDirty = false;
        const rect = cvs.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          mouseX = (pointerX - rect.left) / rect.width;
          mouseY = 1.0 - (pointerY - rect.top) / rect.height;
        }
      }

      const t = (now - start) / 1000;
      g.uniform1f(uTime, t);
      g.uniform2f(uMouse, mouseX, mouseY);
      g.drawArrays(g.TRIANGLES, 0, 6);
    }

    const startLoop = () => {
      if (running) return;
      running = true;
      animId = requestAnimationFrame(frame);
    };
    const stopLoop = () => {
      running = false;
      cancelAnimationFrame(animId);
    };

    // Don't render while scrolled out of view.
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) startLoop();
      else stopLoop();
    });
    io.observe(cvs);

    startLoop();

    return () => {
      stopLoop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('mousemove', onMouse);
      g.deleteProgram(prog);
      g.deleteShader(vs);
      g.deleteShader(fs);
      g.deleteBuffer(buf);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className={styles.canvas} />
  );
}
