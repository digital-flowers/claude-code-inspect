import { useRef, useCallback, type ReactNode, type CSSProperties, type PointerEvent } from 'react';
import './BorderGlow.css';

interface BorderGlowProps {
  children?: ReactNode;
  className?: string;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  edgeSensitivity?: number;
  colors?: string[];
  fillOpacity?: number;
}

const parseHSL = (str: string): { h: number; s: number; l: number } => {
  const m = str.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!m) return { h: 20, s: 70, l: 60 };
  return { h: parseFloat(m[1] ?? '20'), s: parseFloat(m[2] ?? '70'), l: parseFloat(m[3] ?? '60') };
};

const buildGlowVars = (glowColor: string, intensity: number): Record<string, string> => {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  const vars: Record<string, string> = {};
  for (let i = 0; i < opacities.length; i++) {
    vars[`--glow-color${keys[i]}`] =
      `hsl(${base} / ${Math.min((opacities[i] ?? 0) * intensity, 100)}%)`;
  }
  return vars;
};

const POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];
const KEYS = [
  '--gradient-one',
  '--gradient-two',
  '--gradient-three',
  '--gradient-four',
  '--gradient-five',
  '--gradient-six',
  '--gradient-seven',
];

const buildGradientVars = (colors: string[]): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i] ?? 0, colors.length - 1)] ?? colors[0] ?? '#da7756';
    vars[KEYS[i] ?? ''] = `radial-gradient(at ${POSITIONS[i]}, ${c} 0px, transparent 50%)`;
  }
  vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`;
  return vars;
};

export const BorderGlow = ({
  children,
  className = '',
  glowColor = '20 70 60',
  backgroundColor = 'oklch(0.145 0 0)',
  borderRadius = 12,
  glowRadius = 32,
  glowIntensity = 1.0,
  coneSpread = 25,
  edgeSensitivity = 30,
  colors = ['#da7756', '#f4a07b', '#b85c3a'],
  fillOpacity = 0.4,
}: BorderGlowProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const getCenter = useCallback((el: HTMLElement) => {
    const { width, height } = el.getBoundingClientRect();
    return [width / 2, height / 2] as const;
  }, []);

  const getEdgeProximity = useCallback(
    (el: HTMLElement, x: number, y: number) => {
      const [cx, cy] = getCenter(el);
      const dx = x - cx,
        dy = y - cy;
      let kx = Infinity,
        ky = Infinity;
      if (dx !== 0) kx = cx / Math.abs(dx);
      if (dy !== 0) ky = cy / Math.abs(dy);
      return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    },
    [getCenter],
  );

  const getCursorAngle = useCallback(
    (el: HTMLElement, x: number, y: number) => {
      const [cx, cy] = getCenter(el);
      const dx = x - cx,
        dy = y - cy;
      if (dx === 0 && dy === 0) return 0;
      let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (deg < 0) deg += 360;
      return deg;
    },
    [getCenter],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.setProperty('--edge-proximity', `${(getEdgeProximity(el, x, y) * 100).toFixed(3)}`);
      el.style.setProperty('--cursor-angle', `${getCursorAngle(el, x, y).toFixed(3)}deg`);
    },
    [getEdgeProximity, getCursorAngle],
  );

  const handlePointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--edge-proximity', '0');
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`border-glow-card ${className}`}
      style={
        {
          '--card-bg': backgroundColor,
          '--edge-sensitivity': edgeSensitivity,
          '--border-radius': `${borderRadius}px`,
          '--glow-padding': `${glowRadius}px`,
          '--cone-spread': coneSpread,
          '--fill-opacity': fillOpacity,
          ...buildGlowVars(glowColor, glowIntensity),
          ...buildGradientVars(colors),
        } as CSSProperties
      }
    >
      <span className="edge-light" />
      <div className="border-glow-inner">{children}</div>
    </div>
  );
};
