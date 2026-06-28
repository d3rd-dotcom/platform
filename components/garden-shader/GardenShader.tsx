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
  '',
  'float gridLine(float x, float spacing, float width) {',
  '  float g = fract(x / spacing);',
  '  return 1.0 - smoothstep(0.0, width, min(g, 1.0 - g));',
  '}',
  '',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  float a = uRes.x / uRes.y;',
  '  vec2 p = (uv - 0.5) * vec2(a, 1.0);',
  '',
  '  float dx = sin(p.y * 10.0 + uTime * 0.3) * 0.008',
  '           + cos(p.x * 7.0 + uTime * 0.2) * 0.005;',
  '  float dy = cos(p.x * 9.0 + uTime * 0.25) * 0.008',
  '           + sin(p.y * 6.0 + uTime * 0.35) * 0.005;',
  '',
  '  vec2 q = p + vec2(dx, dy);',
  '',
  '  float spacing1 = 0.04;',
  '  float line1 = max(',
  '    gridLine(q.x, spacing1, 0.008),',
  '    gridLine(q.y, spacing1, 0.008)',
  '  );',
  '  ',
  '  float spacing2 = spacing1 * 4.0;',
  '  float line2 = max(',
  '    gridLine(q.x, spacing2, 0.008),',
  '    gridLine(q.y, spacing2, 0.008)',
  '  );',
  '',
  '  vec2 gv = fract(q / spacing2) - 0.5;',
  '  float node = 1.0 - smoothstep(0.0, 0.06, length(gv));',
  '',
  '  float vig = 1.0 - smoothstep(0.1, 1.2, length(p));',
  '',
  '  vec3 lineColor = vec3(0.3, 0.6, 0.95);',
  '',
  '  float pulse = 0.85 + 0.15 * sin(uTime * 0.5);',
  '',
  '  float meshStrength = max(',
  '    line1 * 0.4,',
  '    max(line2 * 0.55, node * 0.5)',
  '  ) * vig * pulse;',
  '',
  '  vec3 final = lineColor * meshStrength;',
  '  float alpha = meshStrength * 0.55;',
  '',
  '  gl_FragColor = vec4(final, alpha);',
  '}',
].join('\n');

export function GardenShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const cvs = canvas;
    const prt = parent;

    let w = prt.clientWidth || window.innerWidth;
    let h = prt.clientHeight || window.innerHeight;
    cvs.width = w;
    cvs.height = h;

    const gl = cvs.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      failIfMajorPerformanceCaveat: false,
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
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, 0);

    const ro = new ResizeObserver(() => {
      w = prt.clientWidth || window.innerWidth;
      h = prt.clientHeight || window.innerHeight;
      cvs.width = w;
      cvs.height = h;
      g.viewport(0, 0, w, h);
      g.uniform2f(uRes, w, h);
    });
    ro.observe(prt);

    let animId = 0;
    const start = performance.now();

    function frame() {
      const t = (performance.now() - start) / 1000;
      g.uniform1f(uTime, t);
      g.drawArrays(g.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
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
