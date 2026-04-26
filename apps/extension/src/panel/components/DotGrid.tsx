import { useRef, useEffect, useCallback } from 'react';

interface Props {
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  glowColor?: string;
  proximity?: number;
  className?: string;
}

interface Dot {
  cx: number;
  cy: number;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return [0, 0, 0];
  return [parseInt(m[0] ?? '0', 16), parseInt(m[1] ?? '0', 16), parseInt(m[2] ?? '0', 16)];
};

export const DotGrid = ({
  dotSize = 3,
  gap = 20,
  baseColor = '#ffffff',
  glowColor = '#da7756',
  proximity = 80,
  className = '',
}: Props) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const pointerRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number | null>(null);

  const baseRgb = hexToRgb(baseColor);
  const glowRgb = hexToRgb(glowColor);

  const buildGrid = useCallback(() => {
    const wrap = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const { width, height } = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    const cell = dotSize + gap;
    const cols = Math.ceil(width / cell) + 1;
    const rows = Math.ceil(height / cell) + 1;

    const dots: Dot[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push({ cx: c * cell, cy: r * cell });
      }
    }
    dotsRef.current = dots;
  }, [dotSize, gap]);

  // Draw loop
  useEffect(() => {
    const proxSq = proximity * proximity;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const { x: px, y: py } = pointerRef.current;

      for (const dot of dotsRef.current) {
        const dx = dot.cx - px;
        const dy = dot.cy - py;
        const dsq = dx * dx + dy * dy;

        let r = baseRgb[0],
          g = baseRgb[1],
          b = baseRgb[2];
        let alpha = 0.25;

        if (dsq <= proxSq) {
          const t = 1 - Math.sqrt(dsq) / proximity;
          r = Math.round(baseRgb[0] + (glowRgb[0] - baseRgb[0]) * t);
          g = Math.round(baseRgb[1] + (glowRgb[1] - baseRgb[1]) * t);
          b = Math.round(baseRgb[2] + (glowRgb[2] - baseRgb[2]) * t);
          alpha = 0.25 + t * 0.65;
        }

        ctx.beginPath();
        ctx.arc(dot.cx, dot.cy, dotSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [proximity, baseRgb, glowRgb, dotSize]);

  // Build grid + resize
  useEffect(() => {
    buildGrid();
    const ro = new ResizeObserver(buildGrid);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [buildGrid]);

  // Pointer tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    const onLeave = () => {
      pointerRef.current = { x: -9999, y: -9999 };
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div ref={wrapperRef} className={`absolute inset-0 ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
