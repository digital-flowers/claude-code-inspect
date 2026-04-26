import {
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type CSSProperties,
  type PointerEvent,
} from 'react';

import './PhotoBorderGlow.css';
import { cn } from '@/panel/lib/utils';

interface Props {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties | undefined;
  sweepDuration?: number; // ms for one auto-sweep revolution
  sweepDelay?: number; // ms to wait before sweep starts
}

const buildGlowVars = (): Record<string, string> => {
  // Use brand orange glow
  const base = '20deg 70% 60%';
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  const vars: Record<string, string> = {};
  for (let i = 0; i < opacities.length; i++) {
    vars[`--glow-color${keys[i]}`] = `hsl(${base} / ${opacities[i]}%)`;
  }
  return vars;
};

const POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];
const COLORS = ['#da7756', '#ffffff', '#ef4444'];
const KEYS = [
  '--gradient-one',
  '--gradient-two',
  '--gradient-three',
  '--gradient-four',
  '--gradient-five',
  '--gradient-six',
  '--gradient-seven',
];

const buildGradientVars = (): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (let i = 0; i < 7; i++) {
    const c = COLORS[COLOR_MAP[i] ?? 0] ?? COLORS[0];
    vars[KEYS[i] ?? ''] = `radial-gradient(at ${POSITIONS[i]}, ${c} 0px, transparent 50%)`;
  }
  vars['--gradient-base'] = `linear-gradient(${COLORS[0]} 0 100%)`;
  return vars;
};

export const PhotoBorderGlow = ({
  children,
  className = '',
  style,
  sweepDuration = 1800,
  sweepDelay = 400,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const mouseActiveRef = useRef(false);

  // On mount: animate one full revolution after a short delay, then hand off to mouse
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sweepEl = el;
    let start: number | null = null;

    const sweep = (now: number) => {
      if (start === null) start = now;
      const t = Math.min((now - start) / sweepDuration, 1);

      // ease-in-out for angle, proximity peaks quickly then fades
      const eased = 1 - Math.pow(1 - t, 3);
      const angle = eased * 270;
      const fadeIn = Math.min(t / 0.15, 1); // reach full in first 15%
      const fadeOut = t >= 0.8 ? 1 - (t - 0.8) / 0.2 : 1; // fade out last 20%
      const proximity = fadeIn * fadeOut * 100;

      if (!mouseActiveRef.current) {
        sweepEl.style.setProperty('--cursor-angle', `${angle.toFixed(2)}deg`);
        sweepEl.style.setProperty('--edge-proximity', `${proximity.toFixed(2)}`);
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(sweep);
      } else {
        sweepEl.classList.remove('no-transition');
      }
    };

    const timer = setTimeout(() => {
      sweepEl.classList.add('no-transition');
      rafRef.current = requestAnimationFrame(sweep);
    }, sweepDelay);

    return () => {
      clearTimeout(timer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [sweepDuration, sweepDelay]);

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
      mouseActiveRef.current = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
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
      className={cn(`photo-border-glow`, className)}
      style={
        {
          '--card-bg': 'transparent',
          '--edge-sensitivity': 30,
          '--border-radius': '7px',
          '--glow-padding': '28px',
          '--cone-spread': 25,
          '--fill-opacity': 0.4,
          ...buildGlowVars(),
          ...buildGradientVars(),
          ...style,
        } as CSSProperties
      }
    >
      <span className="edge-light" />
      <div className="photo-border-glow-inner">{children}</div>
    </div>
  );
};
