"use client";

import { useEffect, useRef } from "react";

const MAX_DPR = 2;
const TAU = Math.PI * 2;
const PERIOD = 3.6;
const BASE_SPREAD = 0.3;
const PERSPECTIVE = 3.5;
const DEPTH_SIZE = 1;
const DEPTH_FADE = 1;
const MIN_RADIUS = 0.6;
const MAX_DOTS = 1024;

type Dot = [number, number, number, number?, number?, string?];
type RGBA = [number, number, number, number];
type Emit = (x: number, y: number, r: number, a: number, col: string) => void;

type Params = {
  n: number;
  sp: number;
  ds: number;
  yw: number;
  sn: number;
  pc: number;
  t: number;
  dot: string;
  acc: string;
};

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function dotsN(base: number, n: number): number {
  const v = Math.round(base * n);
  return v < 1 ? 1 : v;
}

function fib(i: number, n: number): [number, number, number] {
  const y = 1 - (i / Math.max(1, n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const th = 2.399963 * i;
  return [Math.cos(th) * r, y, Math.sin(th) * r];
}

function spin(p: Dot, yaw: number, pitch: number): Dot {
  const ca = Math.cos(yaw);
  const sa = Math.sin(yaw);
  const rx = p[0] * ca - p[2] * sa;
  let rz = p[0] * sa + p[2] * ca;
  const co = Math.cos(pitch);
  const so = Math.sin(pitch);
  const ry = p[1] * co - rz * so;
  rz = p[1] * so + rz * co;
  return [rx, ry, rz, p[3], p[4], p[5]];
}

function frame(t: number, P: Params, out: Dot[]) {
  const n = dotsN(150, P.n);
  for (let i = 0; i < n; i += 1) {
    const q = fib(i, n);
    const s = 1 + 0.13 * Math.sin(TAU * (t - 0.22 * (q[1] + 1)));
    out.push(spin([q[0] * s, q[1] * s, q[2] * s, 0.85, 0.9], TAU * t, 0.36));
  }
}

function project(pts: Dot[], size: number, P: Params, emit: Emit) {
  const c = size / 2;
  const R = size * BASE_SPREAD * P.sp;
  const pv = PERSPECTIVE;
  const yaw = P.yw + TAU * P.sn * P.t;
  const list: Array<[number, number, number, number, string, number]> = [];
  for (const p of pts) {
    const q = spin(p, yaw, P.pc);
    const z = q[2];
    const s = pv / (pv - z);
    const f = clamp01((z + 1.1) / 2.2);
    list.push([
      c + q[0] * R * s,
      c + q[1] * R * s,
      P.ds * (0.4 + 1.6 * DEPTH_SIZE * f) * s * (q[3] === undefined ? 1 : q[3]),
      (0.07 + 0.93 * Math.pow(f, 1.55 * DEPTH_FADE)) *
        (q[4] === undefined ? 1 : q[4]),
      q[5] || P.dot,
      z,
    ]);
  }
  list.sort((a, b) => a[5] - b[5]);
  for (const d of list) emit(d[0], d[1], d[2], d[3], d[4]);
}

const fitCache = new Map<string, number>();

function autoFit(
  size: number,
  P: Params,
  restYaw: number,
  restPitch: number,
): number {
  const key = `${size}/${P.n}/${P.sp}/${restYaw}/${restPitch}/${P.sn}`;
  const hit = fitCache.get(key);
  if (hit !== undefined) return hit;
  const half = size / 2;
  let ext = 0;
  const probe: Params = {
    ...P,
    ds: 1,
    dot: "#fff",
    acc: "#fff",
    t: 0,
    yw: restYaw,
    pc: restPitch,
  };
  const emit: Emit = (x, y, r, a) => {
    if (a <= 0.05 || r <= 0.15) return;
    ext = Math.max(
      ext,
      Math.abs(x - half) + 0.5 * r,
      Math.abs(y - half) + 0.5 * r,
    );
  };
  for (let k = 0; k < 20; k += 1) {
    probe.t = k / 20;
    const out: Dot[] = [];
    frame(probe.t, probe, out);
    project(out, size, probe, emit);
  }
  const fit = ext > 1 ? Math.max(0.55, Math.min(1.7, (0.415 * size) / ext)) : 1;
  fitCache.set(key, fit);
  return fit;
}

function dotScaleFor(size: number): number {
  if (size <= 46) return 0.4;
  if (size <= 190) return 0.4 + ((size - 46) / 144) * 0.6;
  if (size <= 340) return 1 + ((size - 190) / 150) * 0.55;
  return 1.55;
}

function parseColor(input: string | undefined, fb: RGBA): RGBA {
  if (!input) return fb;
  const str = input.trim();
  if (str.charAt(0) === "#") {
    let hex = str.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex =
        hex[0] +
        hex[0] +
        hex[1] +
        hex[1] +
        hex[2] +
        hex[2] +
        (hex.length === 4 ? hex[3] + hex[3] : "");
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return [r, g, b, a];
      }
    }
    return fb;
  }
  const m = str.match(/[\d.]+/g);
  if (m && m.length >= 3) {
    return [
      Math.min(255, parseFloat(m[0])),
      Math.min(255, parseFloat(m[1])),
      Math.min(255, parseFloat(m[2])),
      m.length >= 4 ? Math.min(1, parseFloat(m[3])) : 1,
    ];
  }
  return fb;
}

function css(c: RGBA): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3]})`;
}

function num(v: unknown, fb: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}

function clampN(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

type OrbBreatheProps = {
  width?: number;
  height?: number;
  dotColor?: string;
  density?: number;
  dotSize?: number;
  speed?: number;
  spinTurns?: number;
};

export function OrbBreathe({
  width,
  height,
  dotColor = "#16191D",
  density = 100,
  dotSize = 160,
  speed = 50,
  spinTurns = 1,
}: OrbBreatheProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const vRef = useRef({
    dot: dotColor,
    acc: dotColor,
    speed: clampN(num(speed, 50), -100, 100) / 50,
    density: clampN(num(density, 100), 20, 300) / 100,
    dotSize: clampN(num(dotSize, 100), 20, 300) / 100,
    spinTurns: Math.round(clampN(num(spinTurns, 1), -3, 3)),
    spread: 1,
    turn: 0,
    tilt: 0,
  });

  useEffect(() => {
    sizeRef.current = { w: num(width, 0), h: num(height, 0) };
    vRef.current = {
      ...vRef.current,
      dot: dotColor,
      acc: dotColor,
      speed: clampN(num(speed, 50), -100, 100) / 50,
      density: clampN(num(density, 100), 20, 300) / 100,
      dotSize: clampN(num(dotSize, 100), 20, 300) / 100,
      spinTurns: Math.round(clampN(num(spinTurns, 1), -3, 3)),
    };
  }, [width, height, dotColor, density, dotSize, speed, spinTurns]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let phase = 0;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const v = vRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const cw = sizeRef.current.w || canvas.clientWidth || 120;
      const ch = sizeRef.current.h || canvas.clientHeight || 120;
      const bw = Math.max(1, Math.round(cw * dpr));
      const bh = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      if (!reduce) {
        phase = (phase + (dt * v.speed) / PERIOD) % 1;
        if (phase < 0) phase += 1;
      }

      const size = Math.max(4, Math.min(cw, ch));
      const bx = (cw - size) / 2;
      const by = (ch - size) / 2;
      const dotCol = css(parseColor(v.dot, [22, 25, 29, 1]));
      const P: Params = {
        n: v.density,
        sp: v.spread,
        ds: dotScaleFor(size) * v.dotSize,
        yw: v.turn,
        sn: v.spinTurns,
        pc: v.tilt,
        t: phase,
        dot: dotCol,
        acc: dotCol,
      };
      const fit = autoFit(size, P, v.turn, v.tilt);
      const half = size / 2;
      const out: Dot[] = [];
      frame(phase, P, out);
      let drawn = 0;
      project(out, size, P, (x, y, r, a, col) => {
        if (drawn >= MAX_DOTS) return;
        const rr = r * (0.55 + 0.45 * fit);
        if (rr <= 0.05 || a <= 0.004) return;
        const cx = bx + half + (x - half) * fit;
        const cy = by + half + (y - half) * fit;
        let dr = rr;
        let da = Math.min(1, a);
        if (dr < MIN_RADIUS) {
          da *= (dr / MIN_RADIUS) * (dr / MIN_RADIUS);
          dr = MIN_RADIUS;
        }
        ctx.globalAlpha = da;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, cy, dr, 0, TAU);
        ctx.fill();
        drawn += 1;
      });
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: "transparent",
        minWidth: 24,
        minHeight: 24,
        width: typeof width === "number" && width > 0 ? width : "100%",
        height: typeof height === "number" && height > 0 ? height : "100%",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          background: "transparent",
        }}
      />
    </div>
  );
}
